import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ProvenanceAgent } from 'fhir/r4b';
import { CLAIM_STATUS_FIELDS_BY_KEY, CLAIM_TAG_SYSTEM, getClaimStatusFieldValue, HOLD_TAG_NAME } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { applyClaimStatusField, commitClaimMetaTagsWithProvenance, resolveClaimActor } from '../provenance';
import { assertValidClaimStatusField, buildUpdatedClaimStatusTags, createBillingClient, fetchById } from '../shared';
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

  const enteringNewStage =
    params.field === 'arStage' &&
    !!value &&
    value !== getClaimStatusFieldValue(claim, CLAIM_STATUS_FIELDS_BY_KEY.arStage);

  if (!enteringNewStage) {
    await applyClaimStatusField(oystehr, claim, params.field, value, agent);
    return { ok: true };
  }

  // A claim entering a new AR stage never auto-runs that stage's rules engine. Instead it is held:
  // the Hold tag rides along with the stage change (one transaction, one history record) so the
  // biller preps the claim and chooses when to run the rules (Submit claim / Prepare for invoice).
  let updatedTags = buildUpdatedClaimStatusTags(claim, params.field, value);
  const alreadyHeld = updatedTags.some((t) => t.system === CLAIM_TAG_SYSTEM && t.code === HOLD_TAG_NAME);
  if (!alreadyHeld) updatedTags = [...updatedTags, { system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME }];
  await commitClaimMetaTagsWithProvenance(oystehr, claim, updatedTags, 'statusChange', agent);

  return { ok: true };
}
