import { APIGatewayProxyResult } from 'aws-lambda';
import { buildCanonical, INVALID_INPUT_ERROR, makePaperworkFlowUrl, PaperworkFlowUpdateOutput } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import {
  buildFormsIndex,
  clearFlowFromAllServices,
  getFlow,
  listServiceFlows,
  mintFlow,
  reconcileFlowServiceStamps,
  retireQuestionnaire,
} from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'paperwork-flow-update';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validated = validateRequestParameters(input);
  const { secrets } = validated;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // ── service flow edit ─────────────────────────────────────────────────────
  if (validated.updateType === 'service-flow') {
    const { slug, flow, serviceIds } = validated;
    const formsIndex = await buildFormsIndex(oystehr);
    const formCanonicals = flow.formIds.map(formsIndex.resolveFormCanonical).filter((c): c is string => !!c);

    const updated = await mintFlow(oystehr, { slug, name: flow.name, modes: flow.modes, formCanonicals });
    const flowUrl = updated.url ?? makePaperworkFlowUrl(slug);
    await reconcileFlowServiceStamps(
      oystehr,
      flowUrl,
      buildCanonical(flowUrl, updated.version),
      flow.modes,
      serviceIds
    );

    const record = (await listServiceFlows(oystehr, formsIndex)).find((f) => f.slug === slug);
    const response: PaperworkFlowUpdateOutput = { flow: record };
    return { statusCode: 200, body: JSON.stringify(response) };
  }

  // ── retire (delete) ─────────────────────────────────────────────────────────
  const { slug } = validated;
  const existing = await getFlow(oystehr, slug);
  // Guard: only proceed when we can positively verify the target is a paperwork flow (found by tag).
  if (!existing?.id) {
    throw INVALID_INPUT_ERROR(`No paperwork flow found for slug "${slug}"`);
  }
  await retireQuestionnaire(oystehr, existing.id);
  await clearFlowFromAllServices(oystehr, existing.url ?? makePaperworkFlowUrl(slug));

  const response: PaperworkFlowUpdateOutput = { success: true };
  return { statusCode: 200, body: JSON.stringify(response) };
});
