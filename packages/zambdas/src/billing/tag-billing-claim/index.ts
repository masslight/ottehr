import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Coding, ProvenanceAgent } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { commitClaimMetaTagsWithProvenance, resolveClaimActor } from '../provenance';
import { CLAIM_TAG_SYSTEM, createBillingClient, fetchById } from '../shared';
import { TagBillingClaimParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'tag-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor(oystehr, input.headers?.Authorization, params.secrets);

  const response = await performEffect(oystehr, params, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

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
