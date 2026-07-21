import { APIGatewayProxyResult } from 'aws-lambda';
import { BASE_INTAKE_FLOW_SLUG, INVALID_INPUT_ERROR, PaperworkFlowCreateOutput } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import {
  baseRepresentativeForMode,
  buildFormsIndex,
  computeDesiredModes,
  getBaseCard,
  getServiceFlowVariants,
  listServiceFlows,
  mintServiceFlowVariant,
  reconcileFlowServiceAssignments,
} from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'paperwork-flow-create';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { flow, serviceIds, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  if (Object.values(BASE_INTAKE_FLOW_SLUG).includes(flow.slug)) {
    throw INVALID_INPUT_ERROR('slug is reserved for a base intake flow');
  }
  const existing = await getServiceFlowVariants(oystehr, flow.slug);
  if (existing.length > 0) {
    throw INVALID_INPUT_ERROR(`A paperwork flow with slug "${flow.slug}" already exists`);
  }

  const formsIndex = await buildFormsIndex(oystehr);
  const formCanonicals = flow.formIds.map(formsIndex.resolveFormCanonical).filter((c): c is string => !!c);
  const desiredModes = await computeDesiredModes(oystehr, serviceIds);

  for (const mode of desiredModes) {
    const baseRepresentative =
      flow.base === 'standard' ? baseRepresentativeForMode(mode, await getBaseCard(oystehr, mode)) : undefined;
    await mintServiceFlowVariant(oystehr, {
      groupSlug: flow.slug,
      name: flow.name,
      base: flow.base,
      mode,
      baseRepresentative,
      formCanonicals,
    });
  }
  await reconcileFlowServiceAssignments(oystehr, flow.slug, serviceIds);

  const created = (await listServiceFlows(oystehr, formsIndex)).find((f) => f.slug === flow.slug);
  const response: PaperworkFlowCreateOutput = {
    flow: created ?? { ...flow, modes: desiredModes, serviceIds },
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});
