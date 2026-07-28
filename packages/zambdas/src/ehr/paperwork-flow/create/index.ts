import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
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
  getCanonicalUrlFromQ,
  getFormCanonicals,
  getPatchOperationForExtensionUpsert,
  healthcareServiceExtensionUrlMap,
  PAPERWORK_FLOW_BASE_VERSION,
  searchActiveQuestionnairesByTag,
  searchServiceCategoryHealthcareServices,
} from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'paperwork-flow-create';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { flow, flowServices, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const resources = await getResources(oystehr);
  const slug = await makeUniqueFlowSlug(oystehr, slugify(flow.name));

  console.log('configuring questionnaire resource');
  const flowQuestionnaire = configFlowQuestionnaire(resources.formQuestionnaires, slug, flow, flowServices);

  console.log(
    `configuring healthcare service patch requests for ${flowServices.map(
      (service) => `HealthcareService/${service.id}`
    )}`
  );
  const hsPatchRequests = makeHSPatchRequestsForServices(
    resources.services,
    flowServices,
    flow.modes,
    flowQuestionnaire
  );

  const requests: (BatchInputPostRequest<Questionnaire> | BatchInputPatchRequest<HealthcareService>)[] = [
    { method: 'POST', resource: flowQuestionnaire, url: '/Questionnaire' },
    ...hsPatchRequests,
  ];

  console.log(`making fhir transaction for ${requests.length} requests`);
  await oystehr.fhir.transaction({ requests });

  return { statusCode: 200, body: JSON.stringify({}) };
});

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

interface ResourceConfig {
  formQuestionnaires: Questionnaire[];
  services: HealthcareService[];
}

async function getResources(oystehr: Oystehr): Promise<ResourceConfig> {
  console.log('searching questionnaire and service resources');
  const [formQuestionnaires, services] = await Promise.all([
    searchActiveQuestionnairesByTag(oystehr, PRACTICE_MANAGED_QUESTIONNAIRE_TAG),
    searchServiceCategoryHealthcareServices(oystehr),
  ]);

  return { formQuestionnaires, services };
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
  const canonical = getCanonicalUrlFromQ(flowQuestionnaire);
  if (!canonical) return [];

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
        valueCanonical: canonical,
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
