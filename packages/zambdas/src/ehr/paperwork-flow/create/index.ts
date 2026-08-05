import Oystehr, { BatchInputPatchRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Coding, HealthcareService, Questionnaire } from 'fhir/r4b';
import {
  FlowService,
  getAllFhirSearchPages,
  PAPERWORK_FLOW_TAG,
  PaperworkFlowBase,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  ServiceMode,
  slugify,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import {
  buildFlowQuestionnaire,
  BuildFlowQuestionnaireInput,
  getFormCanonicals,
  getOttehrManagedQuestionnaires,
  getPatchOperationForExtensionUpsert,
  healthcareServiceExtensionUrlMap,
  makeAdditionalFlowQuestionnairePatches,
  PAPERWORK_FLOW_BASE_VERSION,
  searchActiveQuestionnairesByTag,
  searchServiceCategoryHealthcareServices,
} from '../shared';
import { ValidatedRequest, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'paperwork-flow-create';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validatedInput = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

  const effectInput = await complexValidation(validatedInput, oystehr);
  await performEffect(effectInput, oystehr);

  return { statusCode: 200, body: JSON.stringify({}) };
});

interface EffectInput extends ValidatedRequest {
  formQuestionnaires: Questionnaire[];
  flowQuestionnaires: Questionnaire[];
  services: HealthcareService[];
}

async function complexValidation(input: ValidatedRequest, oystehr: Oystehr): Promise<EffectInput> {
  console.log('searching questionnaire and service resources');
  const [formQuestionnaires, ottehrManagedQuestionnaires, flowQuestionnaires, services] = await Promise.all([
    searchActiveQuestionnairesByTag(oystehr, PRACTICE_MANAGED_QUESTIONNAIRE_TAG),
    getOttehrManagedQuestionnaires(oystehr, input.secrets),
    searchActiveQuestionnairesByTag(oystehr, PAPERWORK_FLOW_TAG),
    searchServiceCategoryHealthcareServices(oystehr),
  ]);

  const allFormQuestionnaires = [...formQuestionnaires, ...ottehrManagedQuestionnaires];

  return { ...input, formQuestionnaires: allFormQuestionnaires, flowQuestionnaires, services };
}

async function performEffect(input: EffectInput, oystehr: Oystehr): Promise<void> {
  const { flow, flowServices, formQuestionnaires, flowQuestionnaires, services } = input;

  const slug = await makeUniqueFlowSlug(oystehr, slugify(flow.name));

  const ottehrManagedServices = flowServices.filter((s) => s.ottehrManagedService);

  console.log('configuring questionnaire resource');
  const flowQuestionnaire = configFlowQuestionnaire(formQuestionnaires, slug, flow, flowServices);

  console.log(
    `configuring healthcare service patch requests for ${flowServices.map(
      (service) => `HealthcareService/${service.id}`
    )}`
  );
  const hsPatchRequests = makeHSPatchRequestsForServices(services, flowServices, flow.modes, flowQuestionnaire);

  // Ottehr-managed (service, mode) assignment lives as a meta.tag on the flow Questionnaire, not on the
  // HealthcareService — strip that tag from any other active flow that shares a mode and already claims it.
  const additionalQuestionnairePatches = makeAdditionalFlowQuestionnairePatches({
    modes: flow.modes,
    ottehrManagedServices,
    flowQuestionnaires,
  });

  const requests: BatchInputRequest<Questionnaire | HealthcareService>[] = [
    { method: 'POST', resource: flowQuestionnaire, url: '/Questionnaire' },
    ...hsPatchRequests,
    ...additionalQuestionnairePatches,
  ];

  console.log(`making fhir transaction for ${requests.length} requests`);
  await oystehr.fhir.transaction({ requests });
}

async function makeUniqueFlowSlug(oystehr: Oystehr, desired: string): Promise<string> {
  const searchByTag = async (oystehr: Oystehr, tag: Coding): Promise<Questionnaire[]> => {
    const { system, code } = tag;

    return getAllFhirSearchPages<Questionnaire>(
      { resourceType: 'Questionnaire', params: [{ name: '_tag', value: `${system}|${code}` }] },
      oystehr
    );
  };

  const used = new Set(
    (await searchByTag(oystehr, PAPERWORK_FLOW_TAG)).map((q) => q.url?.split('/').pop()).filter(Boolean)
  );

  const base = desired || 'flow';
  if (!used.has(base)) return base;

  let i = 2;
  while (used.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function configFlowQuestionnaire(
  formQuestionnaires: Questionnaire[],
  uniqueSlug: string,
  flowData: PaperworkFlowBase,
  flowServices: FlowService[]
): Questionnaire {
  const { name, modes, forms } = flowData;
  const ottehrManagedServices = flowServices.filter((s) => s.ottehrManagedService);

  // important: forms must remain in the order which they were sent
  const formCanonicalUrls = getFormCanonicals(formQuestionnaires, forms);

  const qInput: BuildFlowQuestionnaireInput = {
    slug: uniqueSlug,
    version: PAPERWORK_FLOW_BASE_VERSION,
    title: name,
    serviceModes: modes,
    includedForms: formCanonicalUrls,
    status: 'active',
    ottehrManagedServices,
  };

  return buildFlowQuestionnaire(qInput);
}

function makeHSPatchRequestsForServices(
  services: HealthcareService[],
  flowServices: FlowService[],
  modes: ServiceMode[],
  flowQuestionnaire: Questionnaire
): BatchInputPatchRequest<HealthcareService>[] {
  const flowUrl = flowQuestionnaire.url;
  if (!flowUrl) throw new Error(`Could not parse url for Questionnaire/${flowQuestionnaire.id}`);

  const patchRequests: BatchInputPatchRequest<HealthcareService>[] = [];

  const serviceIdMap = new Map<string, HealthcareService>();
  services.forEach((service) => service.id && serviceIdMap.set(service.id, service));

  flowServices.forEach((flowService) => {
    const service = serviceIdMap.get(flowService.id);
    if (flowService.ottehrManagedService || !service) return;

    const operations: Operation[] = [];

    modes.forEach((mode) => {
      const ext = {
        url: healthcareServiceExtensionUrlMap[mode],
        valueCanonical: flowUrl,
      };

      const operation = getPatchOperationForExtensionUpsert(service, ext);
      if (operation) operations.push(operation);
    });

    const patch: BatchInputPatchRequest<HealthcareService> = {
      method: 'PATCH',
      url: `HealthcareService/${flowService.id}`,
      operations,
    };
    patchRequests.push(patch);
  });

  return patchRequests;
}
