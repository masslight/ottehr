import Oystehr, { BatchInputPatchRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { HealthcareService, Questionnaire } from 'fhir/r4b';
import { PAPERWORK_FLOW_TAG, PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { slugify } from 'utils/lib/helpers/slugify';
import { ServiceMode } from 'utils/lib/types/common';
import { FlowService, PaperworkFlowBase } from 'utils/lib/types/data/paperwork-flows/paperwork-flows.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import {
  buildFlowQuestionnaire,
  BuildFlowQuestionnaireInput,
  getFormCanonicals,
  getOttehrManagedQuestionnaires,
  getPatchOperationForExtensionUpsert,
  healthcareServiceExtensionUrlMap,
  makeAdditionalFlowQuestionnairePatches,
  PAPERWORK_FLOW_BASE_VERSION,
  QUESTIONNAIRE_URL_BASE,
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
  uniqueSlugForFlow: string;
}

async function complexValidation(input: ValidatedRequest, oystehr: Oystehr): Promise<EffectInput> {
  console.log('searching questionnaire and service resources');
  const [formQuestionnaires, ottehrManagedQuestionnaires, flowQuestionnaires, services, uniqueSlugForFlow] =
    await Promise.all([
      searchActiveQuestionnairesByTag(oystehr, PRACTICE_MANAGED_QUESTIONNAIRE_TAG),
      getOttehrManagedQuestionnaires(oystehr, input.secrets),
      searchActiveQuestionnairesByTag(oystehr, PAPERWORK_FLOW_TAG),
      searchServiceCategoryHealthcareServices(oystehr),
      makeUniqueFlowSlug(oystehr, input.flow.name),
    ]);

  const allFormQuestionnaires = [...formQuestionnaires, ...ottehrManagedQuestionnaires];

  return { ...input, formQuestionnaires: allFormQuestionnaires, flowQuestionnaires, services, uniqueSlugForFlow };
}

async function performEffect(input: EffectInput, oystehr: Oystehr): Promise<void> {
  const { flow, flowServices, formQuestionnaires, flowQuestionnaires, services, uniqueSlugForFlow } = input;

  const ottehrManagedServices = flowServices.filter((s) => s.ottehrManagedService);

  console.log('configuring questionnaire resource');
  const flowQuestionnaire = configFlowQuestionnaire(formQuestionnaires, uniqueSlugForFlow, flow, flowServices);

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

// i doubt we would ever get to 50, its just here as a precaution
// someone would have had to made 50 identically named flows, which i say is unlikely but who knows!
const MAX_SLUG_ATTEMPTS = 50;

// need to validate url created with this slug is unique across all questionnaires
async function makeUniqueFlowSlug(oystehr: Oystehr, desired: string): Promise<string> {
  const baseSlug = slugify(desired) || 'flow';

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    const candidateUrl = `${QUESTIONNAIRE_URL_BASE}${candidate}`;

    const matches = (
      await oystehr.fhir.search<Questionnaire>({
        resourceType: 'Questionnaire',
        params: [
          { name: 'url', value: candidateUrl },
          { name: '_count', value: '1' },
          { name: '_elements', value: 'id' },
        ],
      })
    ).unbundle();

    if (matches.length === 0) return candidate;
  }

  throw new Error(`Could not find a unique url for flow "${desired}" after ${MAX_SLUG_ATTEMPTS} attempts`);
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
