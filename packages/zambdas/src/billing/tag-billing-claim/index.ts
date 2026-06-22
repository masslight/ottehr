import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { CLAIM_TAG_SYSTEM, createBillingClient, fetchById } from '../shared';
import { TagBillingClaimParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'tag-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: TagBillingClaimParams): Promise<{ ok: true }> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);

  const existingTags = claim.meta?.tag ?? [];
  const hasTag = existingTags.some((t) => t.system === CLAIM_TAG_SYSTEM && t.code === params.tagName);

  const versionId = claim.meta?.versionId;

  if (params.action === 'add' && !hasTag) {
    const updated = [...existingTags, { system: CLAIM_TAG_SYSTEM, code: params.tagName }];
    await oystehr.fhir.patch(
      { resourceType: 'Claim', id: params.claimId, operations: [{ op: 'add', path: '/meta/tag', value: updated }] },
      versionId ? { optimisticLockingVersionId: versionId } : undefined
    );
  } else if (params.action === 'remove' && hasTag) {
    const updated = existingTags.filter((t) => !(t.system === CLAIM_TAG_SYSTEM && t.code === params.tagName));
    await oystehr.fhir.patch(
      { resourceType: 'Claim', id: params.claimId, operations: [{ op: 'add', path: '/meta/tag', value: updated }] },
      versionId ? { optimisticLockingVersionId: versionId } : undefined
    );
  }

  return { ok: true };
}
