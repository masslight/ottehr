import Oystehr, { BatchInputPatchRequest, BatchInputRequest } from '@oystehr/sdk';
import { Claim, ClaimResponse, FhirResource, ProvenanceAgent } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { AR_STAGE, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { ClassifiedClaimStatusResponse, classifyClaimStatusResponse } from './claim-status-response';
import { claimMetaTagsWithProvenanceRequests } from './provenance';
import { buildUpdatedClaimStatusTags, fetchById, findById, hasTag } from './shared';

export interface ClaimStatusContext {
  claimResponse: ClaimResponse;
  claim: Claim;
  classification: ClassifiedClaimStatusResponse;
}

// The caller must check sender eligibility, chronology and duplicates before executing these requests.
export function claimRejectionRequests(
  { claim, claimResponse, classification }: ClaimStatusContext,
  agent: ProvenanceAgent
): BatchInputRequest<FhirResource>[] {
  if (
    classification.kind !== 'rejection-candidate' ||
    !hasTag(claim, BILLING_RESOURCE_TAG.system, BILLING_RESOURCE_TAG.code)
  )
    return [];
  const status = getClaimStatusValues(claim);
  if (status.arStage !== AR_STAGE.insurancePayer || !['submitted', 'adjudicated'].includes(status.insuranceArStatus))
    return [];
  if (status.insurancePaidStatus && status.insurancePaidStatus !== 'unpaid') return [];
  if (status.adjudicationStatus && status.adjudicationStatus !== 'rejected') return [];
  if (!claim.id || !claimResponse.id || !makeOptimisticLockIfMatchHeader(claim)) {
    throw INVALID_INPUT_ERROR('Claim and ClaimResponse IDs and Claim version are required for rejection processing');
  }
  const adjudicated: Claim = {
    ...claim,
    meta: { ...claim.meta, tag: buildUpdatedClaimStatusTags(claim, 'insuranceArStatus', 'adjudicated') },
  };
  const tags = buildUpdatedClaimStatusTags(adjudicated, 'adjudicationStatus', 'rejected');
  return claimMetaTagsWithProvenanceRequests(claim, tags, 'statusChange', agent, {
    sourceReference: `ClaimResponse/${claimResponse.id}`,
    extraChanges: classification.details.map((detail, index) => ({
      field: `rejection.${index}`,
      label: 'Error',
      previousValue: null,
      newValue: detail,
    })),
  });
}

export function claimStatusTagRequest(response: ClaimResponse): BatchInputPatchRequest<FhirResource> | undefined {
  if (hasTag(response, BILLING_RESOURCE_TAG.system, BILLING_RESOURCE_TAG.code)) return undefined;
  const ifMatch = makeOptimisticLockIfMatchHeader(response);
  if (!response.id || !ifMatch)
    throw INVALID_INPUT_ERROR('ClaimResponse ID and version are required for billing tagging');

  return getPatchBinary({
    resourceType: 'ClaimResponse',
    resourceId: response.id,
    ifMatch,
    patchOperations: [
      {
        op: 'add',
        path: response.meta?.tag ? '/meta/tag/-' : '/meta/tag',
        value: response.meta?.tag ? BILLING_RESOURCE_TAG : [BILLING_RESOURCE_TAG],
      },
    ],
  });
}

export async function loadClaimStatusContext(
  projectClient: Oystehr,
  claimResponseId: string
): Promise<ClaimStatusContext | undefined> {
  // Use the project client as Oystehr ClaimResponses do not have the billing workspace tag yet.
  const claimResponse = await fetchById<ClaimResponse>(projectClient, 'ClaimResponse', claimResponseId);
  const classification = classifyClaimStatusResponse(claimResponse);
  if (!classification) return undefined;

  const claim = await resolveClaimForStatusResponse(projectClient, claimResponse);
  if (!claim) return undefined;

  return { claimResponse, claim, classification };
}

export async function resolveClaimForStatusResponse(
  oystehr: Oystehr,
  response: Pick<ClaimResponse, 'id' | 'request'>
): Promise<Claim | undefined> {
  const referenceParts = response.request?.reference?.split('/') ?? [];
  const [resourceType, claimId] = referenceParts;
  if (referenceParts.length !== 2 || resourceType !== 'Claim' || !claimId) {
    throw INVALID_INPUT_ERROR(`ClaimResponse/${response.id} must reference a Claim/<id>`);
  }

  const claim = await findById<Claim>(oystehr, 'Claim', claimId);
  if (!claim) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Claim/${claimId} referenced by ClaimResponse/${response.id} was not found`);
  }
  // The project feed can reference clinical claims so validate it.
  return hasTag(claim, BILLING_RESOURCE_TAG.system, BILLING_RESOURCE_TAG.code) ? claim : undefined;
}
