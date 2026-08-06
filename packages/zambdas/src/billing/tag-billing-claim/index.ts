import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Coding, ProvenanceAgent } from 'fhir/r4b';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { HOLD_TAG_NAME } from 'utils/lib/types/data/billing/rules-engine.constants';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { commitClaimMetaTagsWithProvenance, resolveClaimActor } from '../provenance';
import { createBillingClient, fetchById, fetchDefinedTagNames } from '../shared';
import { TagBillingClaimParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'tag-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

  await complexValidation(oystehr, params);
  const response = await performEffect(oystehr, params, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Adding a tag requires it to exist in the tags feature (the claim-detail UI only offers existing
// tags; this closes the API path). Removal stays unrestricted so an orphaned tag — one whose
// definition was deleted — can still be taken off a claim. Hold is built into the rules engine and
// always allowed.
export async function complexValidation(oystehr: Oystehr, params: TagBillingClaimParams): Promise<void> {
  if (params.action !== 'add' || params.tagName === HOLD_TAG_NAME) return;
  const defined = await fetchDefinedTagNames(oystehr);
  if (!defined.has(params.tagName)) {
    throw INVALID_INPUT_ERROR(`unknown tag "${params.tagName}" — create it on the Tags page first`);
  }
}

async function performEffect(
  oystehr: Oystehr,
  params: TagBillingClaimParams,
  agent: ProvenanceAgent
): Promise<{ ok: true }> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);

  const existingTags = claim.meta?.tag ?? [];
  const hasTag = existingTags.some((t) => t.system === CLAIM_TAG_SYSTEM && t.code === params.tagName);

  let updatedTags: Coding[] | undefined;
  if (params.action === 'add' && !hasTag) {
    updatedTags = [...existingTags, { system: CLAIM_TAG_SYSTEM, code: params.tagName }];
  } else if (params.action === 'remove' && hasTag) {
    updatedTags = existingTags.filter((t) => !(t.system === CLAIM_TAG_SYSTEM && t.code === params.tagName));
  }
  if (!updatedTags) return { ok: true };

  await commitClaimMetaTagsWithProvenance(oystehr, claim, updatedTags, 'tagChange', agent);

  return { ok: true };
}
