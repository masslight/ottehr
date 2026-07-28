import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Extension, HealthcareService, Questionnaire } from 'fhir/r4b';
import { isEqual } from 'lodash-es';
import {
  FlowService,
  PAPERWORK_FLOW_MODE_EXTENSION_URL,
  PAPERWORK_FLOW_TAG,
  PaperworkFlowBase,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  Secrets,
  ServiceMode,
  SYSTEM_MANAGED_SERVICE_TAG_SYSTEM,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { patchQuestionnaireVersion } from '../../practice-managed-questionnaire/helpers';
import {
  buildFlowQuestionnaire,
  getCanonicalUrlFromQ,
  getFormCanonicals,
  getOttehrManagedQuestionnaires,
  healthcareServiceExtensionUrlMap,
  PAPERWORK_FLOW_BASE_VERSION,
  searchActiveQuestionnairesByTag,
  searchServiceCategoryHealthcareServices,
} from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'paperwork-flow-update';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validated = validateRequestParameters(input);
  const { flow, flowServices, flowId, secrets } = validated;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // get all active flow & form questionnaires
  // get all services
  const resources = await getResources(oystehr, flowId, secrets);
  const canonical = getCanonicalUrlFromQ(resources.targetFlowQuestionnaire);

  if (!canonical) throw new Error(`Could not parse canonical url from Questionnaire/${flowId}`);

  const ottehrManagedServices = flowServices.filter((s) => s.ottehrManagedService);

  const {
    retirePatch: targetFlowQuestionnaireRetirePatch,
    createPost: targetFlowQuestionnaireCreatePost,
    nextCanonical,
  } = makeTargetFlowQuestionnaireRequests({
    flow,
    ottehrManagedServices,
    flowQuestionnaire: resources.targetFlowQuestionnaire,
    formQuestionnaires: resources.allFormQuestionnaires,
  });

  const additionalQuestionnairePatches = makeAdditionalFlowQuestionnairePatches({
    modes: flow.modes,
    ottehrManagedServices,
    flowQuestionnaires: resources.allFlowQuestionnaires,
    targetFlowId: flowId,
  });

  const healthServicePatches = makeHealthServicePatches({
    allServices: resources.allServices,
    flowServices,
    modes: flow.modes,
    previousCanonical: canonical,
    nextCanonical,
  });

  const requests: BatchInputRequest<Questionnaire | HealthcareService>[] = [
    targetFlowQuestionnaireRetirePatch,
    targetFlowQuestionnaireCreatePost,
    ...additionalQuestionnairePatches,
    ...healthServicePatches,
  ];

  console.log(`making fhir transaction for ${requests.length} requests`);
  await oystehr.fhir.transaction({ requests });

  return { statusCode: 200, body: JSON.stringify({}) };
});
interface ResourceConfig {
  targetFlowQuestionnaire: Questionnaire;
  allFlowQuestionnaires: Questionnaire[];
  allFormQuestionnaires: Questionnaire[];
  allServices: HealthcareService[];
}
async function getResources(oystehr: Oystehr, flowId: string, secrets: Secrets | null): Promise<ResourceConfig> {
  console.log('searching questionnaire and service resources');
  const [targetFlowQuestionnaire, allFlowQuestionnaires, formQuestionnaires, ottehrManagedQuestionnaires, allServices] =
    await Promise.all([
      oystehr.fhir.get<Questionnaire>({ resourceType: 'Questionnaire', id: flowId }),
      searchActiveQuestionnairesByTag(oystehr, PAPERWORK_FLOW_TAG),
      searchActiveQuestionnairesByTag(oystehr, PRACTICE_MANAGED_QUESTIONNAIRE_TAG),
      getOttehrManagedQuestionnaires(oystehr, secrets),
      searchServiceCategoryHealthcareServices(oystehr),
    ]);

  const allFormQuestionnaires = [...formQuestionnaires, ...ottehrManagedQuestionnaires];

  return { targetFlowQuestionnaire, allFlowQuestionnaires, allFormQuestionnaires, allServices };
}

// Edits mint a new, bumped-version Questionnaire rather than patching the existing one in place —
// canonical FHIR resources are versioned, not mutated (see create/buildFlowQuestionnaire). The
// previous resource is retired so it drops out of the active-flow searches.
function makeTargetFlowQuestionnaireRequests(input: {
  flow: PaperworkFlowBase;
  ottehrManagedServices: FlowService[];
  flowQuestionnaire: Questionnaire;
  formQuestionnaires: Questionnaire[];
}): {
  retirePatch: BatchInputPatchRequest<Questionnaire>;
  createPost: BatchInputPostRequest<Questionnaire>;
  nextCanonical: string;
} {
  const { flow, ottehrManagedServices, flowQuestionnaire, formQuestionnaires } = input;

  const nextVersion = flowQuestionnaire.version
    ? patchQuestionnaireVersion(flowQuestionnaire.version)
    : PAPERWORK_FLOW_BASE_VERSION;

  const slug = flowQuestionnaire.url?.split('/').pop();
  if (!slug) throw new Error(`Could not parse the flow slug from Questionnaire/${flowQuestionnaire.id}`);

  const nextCanonical = `${flowQuestionnaire.url}|${nextVersion}`;

  // important: forms must remain in the order which they were sent
  const formCanonicalUrls = getFormCanonicals(formQuestionnaires, flow.forms);

  const newQuestionnaire = buildFlowQuestionnaire({
    slug,
    version: nextVersion,
    title: flow.name,
    serviceModes: flow.modes,
    includedForms: formCanonicalUrls,
    status: 'active',
    ottehrManagedServices,
  });

  const retirePatch: BatchInputPatchRequest<Questionnaire> = {
    method: 'PATCH',
    url: `Questionnaire/${flowQuestionnaire.id}`,
    operations: [{ op: 'replace', path: '/status', value: 'retired' }],
  };

  const createPost: BatchInputPostRequest<Questionnaire> = {
    method: 'POST',
    resource: newQuestionnaire,
    url: '/Questionnaire',
  };

  return { retirePatch, createPost, nextCanonical };
}

function getFlowModes(q: Questionnaire): ServiceMode[] {
  return (q.extension ?? [])
    .filter((ext) => ext.url === PAPERWORK_FLOW_MODE_EXTENSION_URL)
    .map((ext) => ext.valueCode)
    .filter((mode): mode is ServiceMode => mode != null);
}

// make additional questionnaire patches (if necessary)
// if flowServices includes any ottehr managed services, check if any flows with the passed visit modes already contain it
// // yes -> remove the tag
// // no -> do nothing
function makeAdditionalFlowQuestionnairePatches(input: {
  modes: ServiceMode[];
  ottehrManagedServices: FlowService[];
  flowQuestionnaires: Questionnaire[];
  targetFlowId: string;
}): BatchInputPatchRequest<Questionnaire>[] {
  const { modes, ottehrManagedServices, flowQuestionnaires, targetFlowId } = input;
  const patchRequests: BatchInputPatchRequest<Questionnaire>[] = [];

  if (ottehrManagedServices.length === 0) return patchRequests;

  const ottehrManagedServiceIds = new Set(ottehrManagedServices.map((service) => service.id));

  flowQuestionnaires.forEach((q) => {
    if (q.id === targetFlowId) return;

    // this flow doesn't share a visit mode with the flow being saved, so it isn't competing for the same slot
    const sharesMode = getFlowModes(q).some((mode) => modes.includes(mode));
    if (!sharesMode) return;

    const existingTags = q.meta?.tag ?? [];
    const remainingTags = existingTags.filter((t) => {
      const systemManagedServiceTag = t.system === SYSTEM_MANAGED_SERVICE_TAG_SYSTEM;
      if (!systemManagedServiceTag) return true;

      return !t.code || !ottehrManagedServiceIds.has(t.code);
    });

    // nothing to remove from this flow's tags
    if (remainingTags.length === existingTags.length) return;

    const operations: Operation[] = [{ op: 'replace', path: '/meta/tag', value: remainingTags }];

    patchRequests.push({
      method: 'PATCH',
      url: `Questionnaire/${q.id}`,
      operations,
    });
  });

  return patchRequests;
}

// Builds the full next `extension` array for a service given the modes this flow wants it to carry
// (empty if the service isn't included in the flow at all). For each visit mode:
// // desired -> upsert this flow's (bumped) canonical into that mode's slot
// // not desired, but this flow currently holds that mode's slot -> relinquish it
// // not desired and held by some other flow -> leave untouched
function computeNextServiceExtensions(input: {
  service: HealthcareService;
  desiredModes: ServiceMode[];
  previousCanonical: string;
  nextCanonical: string;
}): Extension[] {
  const { service, desiredModes, previousCanonical, nextCanonical } = input;
  const nextExtensions = [...(service.extension ?? [])];

  Object.values(ServiceMode).forEach((mode) => {
    const url = healthcareServiceExtensionUrlMap[mode];
    const existingIndex = nextExtensions.findIndex((ext) => ext.url === url);

    if (desiredModes.includes(mode)) {
      const ext = { url, valueCanonical: nextCanonical };
      if (existingIndex === -1) {
        nextExtensions.push(ext);
      } else {
        nextExtensions[existingIndex] = ext;
      }
      return;
    }

    if (existingIndex !== -1 && nextExtensions[existingIndex].valueCanonical === previousCanonical) {
      nextExtensions.splice(existingIndex, 1);
    }
  });

  return nextExtensions;
}

// make HS patches
// if there's a diff in the flowServices currently included and what has been passed:
// // a service has been removed from the flow, patch to remove extension from the HS
// // a service has been added to the flow, patch to add the extension from the HS
// // a service kept modes dropped from the flow, patch to remove those modes' extensions from the HS
function makeHealthServicePatches(input: {
  allServices: HealthcareService[];
  flowServices: FlowService[];
  modes: ServiceMode[];
  previousCanonical: string;
  nextCanonical: string;
}): BatchInputPatchRequest<HealthcareService>[] {
  const { allServices, flowServices, modes, previousCanonical, nextCanonical } = input;

  const desiredServiceIds = new Set(
    flowServices.filter((service) => !service.ottehrManagedService).map((service) => service.id)
  );

  const patchRequests: BatchInputPatchRequest<HealthcareService>[] = [];

  allServices.forEach((service) => {
    if (!service.id) return;

    const desiredModes = desiredServiceIds.has(service.id) ? modes : [];
    const existingExtensions = service.extension ?? [];
    const nextExtensions = computeNextServiceExtensions({ service, desiredModes, previousCanonical, nextCanonical });

    if (isEqual(existingExtensions, nextExtensions)) return;

    patchRequests.push({
      method: 'PATCH',
      url: `HealthcareService/${service.id}`,
      operations: [{ op: 'replace', path: '/extension', value: nextExtensions }],
    });
  });

  return patchRequests;
}
