import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ProvenanceAgent } from 'fhir/r4b';
import { CLAIM_STATUS_FIELDS_BY_KEY, getClaimStatusFieldValue } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { applyClaimStatusField, resolveClaimActor } from '../provenance';
import {
  assertValidClaimStatusField,
  buildUpdatedClaimStatusTags,
  createBillingClient,
  determineRulesEngineForClaim,
  fetchById,
  kickOffRulesEngine,
  STAGE_ENTRY_RULES_ENGINES,
} from '../shared';
import { SetClaimStatusParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'set-billing-claim-status';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor(oystehr, input.headers?.Authorization, params.secrets);

  const response = await performEffect(oystehr, params, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  params: SetClaimStatusParams,
  agent: ProvenanceAgent
): Promise<{ ok: true }> {
  const value = assertValidClaimStatusField(params.field, params.value ?? null);
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
  await applyClaimStatusField(oystehr, claim, params.field, value, agent);

  // A claim entering Non-insurance Payer AR (or Patient AR, when self-pay) auto-runs that stage's
  // pre-invoice rules engine — the same run its creation in that stage would have triggered.
  if (
    params.field === 'arStage' &&
    value &&
    value !== getClaimStatusFieldValue(claim, CLAIM_STATUS_FIELDS_BY_KEY.arStage)
  ) {
    // The engine is decided against the claim as just written (applyClaimStatusField committed
    // these same tags, including the entered stage's initialized progress status).
    const after: Claim = {
      ...claim,
      meta: { ...claim.meta, tag: buildUpdatedClaimStatusTags(claim, 'arStage', value) },
    };
    const engine = determineRulesEngineForClaim(after);
    if (engine && STAGE_ENTRY_RULES_ENGINES.includes(engine)) {
      await kickOffRulesEngine(oystehr, engine, params.claimId, params.secrets);
    }
  }

  return { ok: true };
}
