import Oystehr, { BatchInputPatchRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, Questionnaire } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import {
  getCanonicalUrlFromQ,
  getFlowModes,
  healthcareServiceExtensionUrlMap,
  searchServiceCategoryHealthcareServices,
} from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'paperwork-flow-delete';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validated = validateRequestParameters(input);
  const { flowId, secrets } = validated;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  console.log('getting resources to retire flow');
  const { targetFlowQuestionnaire, services } = await getResources(oystehr, flowId);

  console.log(`Configuring patch to retire Questionnaire/${flowId}`);
  const retireQPatch = makeRetireQPatch(flowId);

  const servicePatches = clearFlowFromServicePatches(services, targetFlowQuestionnaire);

  const requests: BatchInputPatchRequest<Questionnaire | HealthcareService>[] = [retireQPatch, ...servicePatches];

  console.log(`making fhir transaction for ${requests.length} requests`);
  await oystehr.fhir.transaction({ requests });

  return { statusCode: 200, body: JSON.stringify({}) };
});

interface ResourceConfig {
  targetFlowQuestionnaire: Questionnaire;
  services: HealthcareService[];
}
async function getResources(oystehr: Oystehr, flowId: string): Promise<ResourceConfig> {
  console.log('searching questionnaire and service resources');
  const [targetFlowQuestionnaire, services] = await Promise.all([
    oystehr.fhir.get<Questionnaire>({ resourceType: 'Questionnaire', id: flowId }),
    searchServiceCategoryHealthcareServices(oystehr),
  ]);

  return { targetFlowQuestionnaire, services };
}

function makeRetireQPatch(flowId: string): BatchInputPatchRequest<Questionnaire> {
  const retirePatch: BatchInputPatchRequest<Questionnaire> = {
    method: 'PATCH',
    url: `Questionnaire/${flowId}`,
    operations: [{ op: 'replace', path: '/status', value: 'retired' }],
  };
  return retirePatch;
}

// Detach every service pointing at `flowUrl` (only for modes included in this flow)
function clearFlowFromServicePatches(
  services: HealthcareService[],
  flow: Questionnaire
): BatchInputPatchRequest<HealthcareService>[] {
  const canonical = getCanonicalUrlFromQ(flow);
  const modesIncluded = getFlowModes(flow);

  console.log(`Clearing flow: removing ${canonical} for modes: ${modesIncluded}`);

  const modeExtensionUrls = new Set(modesIncluded.map((mode) => healthcareServiceExtensionUrlMap[mode]));
  const patches: BatchInputPatchRequest<HealthcareService>[] = [];

  for (const service of services) {
    if (!service.id) continue;

    const existingExtensions = service.extension ?? [];
    const nextExtensions = existingExtensions.filter(
      (ext) => !(modeExtensionUrls.has(ext.url) && ext.valueCanonical === canonical)
    );

    if (nextExtensions.length === existingExtensions.length) continue;

    patches.push({
      method: 'PATCH',
      url: `HealthcareService/${service.id}`,
      operations: [{ op: 'replace', path: '/extension', value: nextExtensions }],
    });
  }

  console.log(`Resources to be cleared of this flow: ${patches.length ? patches.map((patch) => patch.url) : 'none'}`);

  return patches;
}
