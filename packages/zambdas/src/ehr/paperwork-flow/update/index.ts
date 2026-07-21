import { APIGatewayProxyResult } from 'aws-lambda';
import {
  BASE_INTAKE_FLOW_SLUG,
  buildCanonical,
  INVALID_INPUT_ERROR,
  PaperworkFlowUpdateOutput,
  readServiceFlowMode,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import {
  baseRepresentativeForMode,
  buildFormsIndex,
  cascadeBaseChange,
  clearFlowFromAllServices,
  computeDesiredModes,
  getBaseCard,
  getServiceFlowVariants,
  listBaseFlows,
  listServiceFlows,
  mintBaseCard,
  mintServiceFlowVariant,
  reconcileFlowServiceAssignments,
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
  const formsIndex = await buildFormsIndex(oystehr);

  // ── base intake card autosave ──────────────────────────────────────────────
  if (validated.updateType === 'base-intake') {
    const { mode, formIds } = validated;
    const previous = await getBaseCard(oystehr, mode);
    const oldRep = baseRepresentativeForMode(mode, previous);
    const formCanonicals = formIds.map(formsIndex.resolveFormCanonical).filter((c): c is string => !!c);

    let newRep: string;
    if (formCanonicals.length > 0) {
      const card = await mintBaseCard(oystehr, { mode, formCanonicals });
      newRep = buildCanonical(card.url ?? '', card.version);
    } else {
      // emptied: retire the card (if materialized); the representative reverts to the raw mode intake
      if (previous?.id) await retireQuestionnaire(oystehr, previous.id);
      newRep = baseRepresentativeForMode(mode, undefined);
    }
    await cascadeBaseChange(oystehr, mode, oldRep, newRep);

    const baseFlow = (await listBaseFlows(oystehr, formsIndex)).find((b) => b.mode === mode);
    const response: PaperworkFlowUpdateOutput = { baseFlow };
    return { statusCode: 200, body: JSON.stringify(response) };
  }

  // ── service flow create/edit ─────────────────────────────────────────────────
  if (validated.updateType === 'service-flow') {
    const { flow, serviceIds } = validated;
    if (Object.values(BASE_INTAKE_FLOW_SLUG).includes(flow.slug)) {
      throw INVALID_INPUT_ERROR('slug is reserved for a base intake flow');
    }
    const formCanonicals = flow.formIds.map(formsIndex.resolveFormCanonical).filter((c): c is string => !!c);
    const desiredModes = await computeDesiredModes(oystehr, serviceIds);
    const existing = await getServiceFlowVariants(oystehr, flow.slug);

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
    // retire variants for modes this flow no longer covers
    for (const variant of existing) {
      const mode = readServiceFlowMode(variant);
      if (mode && !desiredModes.includes(mode) && variant.id) await retireQuestionnaire(oystehr, variant.id);
    }
    await reconcileFlowServiceAssignments(oystehr, flow.slug, serviceIds);

    const updated = (await listServiceFlows(oystehr, formsIndex)).find((f) => f.slug === flow.slug);
    const response: PaperworkFlowUpdateOutput = { flow: updated };
    return { statusCode: 200, body: JSON.stringify(response) };
  }

  // ── retire (delete) ─────────────────────────────────────────────────────────
  const { slug } = validated;
  if (Object.values(BASE_INTAKE_FLOW_SLUG).includes(slug)) {
    throw INVALID_INPUT_ERROR('cannot delete a base intake flow');
  }
  const variants = await getServiceFlowVariants(oystehr, slug);
  // Guard: only proceed when we can positively verify the target is a (non-base) service flow.
  // Variants are found by the service-flow group identifier, which base intake flows never carry.
  if (variants.length === 0) {
    throw INVALID_INPUT_ERROR(`No service flow found for slug "${slug}"`);
  }
  for (const variant of variants) {
    if (variant.id) await retireQuestionnaire(oystehr, variant.id);
  }
  await clearFlowFromAllServices(oystehr, slug);

  const response: PaperworkFlowUpdateOutput = { success: true };
  return { statusCode: 200, body: JSON.stringify(response) };
});
