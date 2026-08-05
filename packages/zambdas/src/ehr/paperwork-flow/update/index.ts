import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Extension, HealthcareService, Questionnaire } from 'fhir/r4b';
import { isEqual } from 'lodash-es';
import {
  FlowService,
  makeOptimisticLockIfMatchHeader,
  PAPERWORK_FLOW_ERROR,
  PAPERWORK_FLOW_TAG,
  PaperworkFlowBase,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  ServiceMode,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { patchQuestionnaireVersion } from '../../practice-managed-questionnaire/helpers';
import {
  buildFlowQuestionnaire,
  getCanonicalUrlFromQ,
  getFormCanonicals,
  getOttehrManagedQuestionnaires,
  healthcareServiceExtensionUrlMap,
  makeAdditionalFlowQuestionnairePatches,
  PAPERWORK_FLOW_BASE_VERSION,
  searchActiveQuestionnairesByTag,
  searchServiceCategoryHealthcareServices,
} from '../shared';
import { ValidatedRequest, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'paperwork-flow-update';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validated = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validated.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validated.secrets);

  const effectInput = await complexValidation(validated, oystehr);
  await performEffect(effectInput, oystehr);

  return { statusCode: 200, body: JSON.stringify({}) };
});

interface EffectInput extends ValidatedRequest {
  targetFlowQuestionnaire: Questionnaire;
  allFlowQuestionnaires: Questionnaire[];
  allFormQuestionnaires: Questionnaire[];
  allServices: HealthcareService[];
}

async function complexValidation(input: ValidatedRequest, oystehr: Oystehr): Promise<EffectInput> {
  const { flowId, secrets } = input;
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

  if (targetFlowQuestionnaire.status !== 'active') {
    throw PAPERWORK_FLOW_ERROR(
      `The flow you are trying to edit has been updated, please refresh the page and try again.`
    );
  }

  return { ...input, targetFlowQuestionnaire, allFlowQuestionnaires, allFormQuestionnaires, allServices };
}

async function performEffect(input: EffectInput, oystehr: Oystehr): Promise<void> {
  const {
    flow,
    flowServices,
    flowId,
    targetFlowQuestionnaire,
    allFlowQuestionnaires,
    allFormQuestionnaires,
    allServices,
  } = input;
  // canonical === url|version
  const canonical = getCanonicalUrlFromQ(targetFlowQuestionnaire);
  const flowUrl = targetFlowQuestionnaire.url;

  if (!canonical) throw new Error(`Could not parse url|version from Questionnaire/${flowId}`);
  if (!flowUrl) throw new Error(`Could not parse url from from Questionnaire/${flowId}`);

  const ottehrManagedServices = flowServices.filter((s) => s.ottehrManagedService);

  const { retirePatch: targetFlowQuestionnaireRetirePatch, createPost: targetFlowQuestionnaireCreatePost } =
    makeTargetFlowQuestionnaireRequests({
      flow,
      ottehrManagedServices,
      flowQuestionnaire: targetFlowQuestionnaire,
      formQuestionnaires: allFormQuestionnaires,
    });

  console.log(`Retiring target version ${targetFlowQuestionnaireRetirePatch.url}`);

  const additionalQuestionnairePatches = makeAdditionalFlowQuestionnairePatches({
    modes: flow.modes,
    ottehrManagedServices,
    flowQuestionnaires: allFlowQuestionnaires,
    targetFlowId: flowId,
  });

  const healthServicePatches = makeHealthServicePatches({
    allServices,
    flowServices,
    modes: flow.modes,
    flowUrl,
  });

  const requests: BatchInputRequest<Questionnaire | HealthcareService>[] = [
    targetFlowQuestionnaireRetirePatch,
    targetFlowQuestionnaireCreatePost,
    ...additionalQuestionnairePatches,
    ...healthServicePatches,
  ];

  console.log(`making fhir transaction for ${requests.length} requests`);
  await oystehr.fhir.transaction({ requests });
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
} {
  const { flow, ottehrManagedServices, flowQuestionnaire, formQuestionnaires } = input;

  const nextVersion = flowQuestionnaire.version
    ? patchQuestionnaireVersion(flowQuestionnaire.version)
    : PAPERWORK_FLOW_BASE_VERSION;

  const slug = flowQuestionnaire.url?.split('/').pop();
  if (!slug) throw new Error(`Could not parse the flow slug from Questionnaire/${flowQuestionnaire.id}`);

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
    ifMatch: makeOptimisticLockIfMatchHeader(flowQuestionnaire),
  };

  const createPost: BatchInputPostRequest<Questionnaire> = {
    method: 'POST',
    resource: newQuestionnaire,
    url: '/Questionnaire',
  };

  return { retirePatch, createPost };
}

// Builds the full next `extension` array for a service given the modes this flow wants it to carry
// (empty if the service isn't included in the flow at all)
function computeNextServiceExtensions(input: {
  service: HealthcareService;
  desiredModes: ServiceMode[];
  flowUrl: string;
}): Extension[] {
  const { service, desiredModes, flowUrl } = input;
  const nextExtensions = [...(service.extension ?? [])];

  Object.values(ServiceMode).forEach((mode) => {
    const url = healthcareServiceExtensionUrlMap[mode];
    const existingIndex = nextExtensions.findIndex((ext) => ext.url === url);

    if (desiredModes.includes(mode)) {
      const ext = { url, valueCanonical: flowUrl };
      if (existingIndex === -1) {
        // being added to a flow for this mode
        nextExtensions.push(ext);
      } else {
        // being moved into a new flow for this mode
        nextExtensions[existingIndex] = ext;
      }
      return;
    }

    // removed from the flow for this mode
    if (existingIndex !== -1 && nextExtensions[existingIndex].valueCanonical === flowUrl) {
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
  flowUrl: string;
}): BatchInputPatchRequest<HealthcareService>[] {
  const { allServices, flowServices, modes, flowUrl } = input;

  const desiredServiceIds = new Set(
    flowServices.filter((service) => !service.ottehrManagedService).map((service) => service.id)
  );

  const patchRequests: BatchInputPatchRequest<HealthcareService>[] = [];

  allServices.forEach((service) => {
    if (!service.id) return;

    const desiredModes = desiredServiceIds.has(service.id) ? modes : [];
    const existingExtensions = service.extension ?? [];
    const nextExtensions = computeNextServiceExtensions({ service, desiredModes, flowUrl });

    if (isEqual(existingExtensions, nextExtensions)) return;

    patchRequests.push({
      method: 'PATCH',
      url: `HealthcareService/${service.id}`,
      operations: [{ op: 'replace', path: '/extension', value: nextExtensions }],
    });
  });

  return patchRequests;
}
