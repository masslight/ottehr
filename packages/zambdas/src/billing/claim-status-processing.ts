import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { fetchById, hasTag } from './shared';

export async function resolveClaimForStatusResponse(
  oystehr: Oystehr,
  response: Pick<ClaimResponse, 'id' | 'request'>
): Promise<Claim | undefined> {
  const referenceParts = response.request?.reference?.split('/') ?? [];
  const [resourceType, claimId] = referenceParts;
  if (referenceParts.length !== 2 || resourceType !== 'Claim' || !claimId) {
    throw new Error(`ClaimResponse/${response.id} must reference a Claim/<id>`);
  }

  let claim: Claim;
  try {
    claim = await fetchById<Claim>(oystehr, 'Claim', claimId);
  } catch (cause) {
    throw new Error(`Unable to resolve Claim/${claimId} for ClaimResponse/${response.id}`, { cause });
  }
  // The project feed can reference clinical claims so validate it.
  return hasTag(claim, BILLING_RESOURCE_TAG.system, BILLING_RESOURCE_TAG.code) ? claim : undefined;
}
