import Oystehr, { BatchInputPatchRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, Questionnaire } from 'fhir/r4b';
import { makeOptimisticLockIfMatchHeader } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { getFlowModes, healthcareServiceExtensionUrlMap, searchServiceCategoryHealthcareServices } from '../shared';
import { ValidatedRequest, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'paperwork-flow-delete';

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
  services: HealthcareService[];
}

async function complexValidation(input: ValidatedRequest, oystehr: Oystehr): Promise<EffectInput> {
  const { flowId } = input;
  console.log('searching questionnaire and service resources');
  const [targetFlowQuestionnaire, services] = await Promise.all([
    oystehr.fhir.get<Questionnaire>({ resourceType: 'Questionnaire', id: flowId }),
    searchServiceCategoryHealthcareServices(oystehr),
  ]);

  return { ...input, targetFlowQuestionnaire, services };
}

async function performEffect(input: EffectInput, oystehr: Oystehr): Promise<void> {
  const { flowId, targetFlowQuestionnaire, services } = input;

  const retireQPatch = makeRetireQPatch(targetFlowQuestionnaire);

  console.log(`Configuring patch to retire Questionnaire/${flowId}`);
  const servicePatches = clearFlowFromServicePatches(services, targetFlowQuestionnaire);

  const requests: BatchInputPatchRequest<Questionnaire | HealthcareService>[] = [retireQPatch, ...servicePatches];

  console.log(`making fhir transaction for ${requests.length} requests`);
  await oystehr.fhir.transaction({ requests });
}

function makeRetireQPatch(flow: Questionnaire): BatchInputPatchRequest<Questionnaire> {
  const retirePatch: BatchInputPatchRequest<Questionnaire> = {
    method: 'PATCH',
    url: `Questionnaire/${flow.id}`,
    operations: [{ op: 'replace', path: '/status', value: 'retired' }],
    ifMatch: makeOptimisticLockIfMatchHeader(flow),
  };
  return retirePatch;
}

// Detach every service pointing at `flowUrl` (only for modes included in this flow)
function clearFlowFromServicePatches(
  services: HealthcareService[],
  flow: Questionnaire
): BatchInputPatchRequest<HealthcareService>[] {
  const flowUrl = flow.url;
  const modesIncluded = getFlowModes(flow);

  console.log(`Clearing flow: removing ${flowUrl} for modes: ${modesIncluded}`);

  const modeExtensionUrls = new Set(modesIncluded.map((mode) => healthcareServiceExtensionUrlMap[mode]));
  const patches: BatchInputPatchRequest<HealthcareService>[] = [];

  for (const service of services) {
    if (!service.id) continue;

    const existingExtensions = service.extension ?? [];
    const nextExtensions = existingExtensions.filter(
      (ext) => !(modeExtensionUrls.has(ext.url) && ext.valueCanonical === flowUrl)
    );

    if (nextExtensions.length === existingExtensions.length) continue;

    patches.push({
      method: 'PATCH',
      url: `HealthcareService/${service.id}`,
      operations: [{ op: 'replace', path: '/extension', value: nextExtensions }],
      ifMatch: makeOptimisticLockIfMatchHeader(flow),
    });
  }

  console.log(`Resources to be cleared of this flow: ${patches.length ? patches.map((patch) => patch.url) : 'none'}`);

  return patches;
}
