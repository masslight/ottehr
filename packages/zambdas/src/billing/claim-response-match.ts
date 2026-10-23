import { BatchInputPostRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { ClaimResponse, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { matchedClaimId } from './claim-amounts';
import { claimEventProvenanceRequest } from './provenance';

// What matching a payer response to a claim rewrites. The insurer stays as the ERA reported it,
// since the claim's payer may differ.
export const MATCH_FIELDS = ['request', 'patient', 'type'] as const;
// Unmatching also puts back the payer of the claim the ERA keyed.
export const UNMATCH_FIELDS = [...MATCH_FIELDS, 'insurer'] as const;

export function matchFieldsPatchOperations(
  claimResponse: ClaimResponse,
  fields: readonly (typeof UNMATCH_FIELDS)[number][]
): Operation[] {
  return fields.map((field) => ({
    op: 'replace',
    path: `/${field}`,
    value: claimResponse[field],
  }));
}

export function claimMatchHistoryRequests({
  before,
  after,
  agent,
}: {
  before: ClaimResponse;
  after: ClaimResponse;
  agent: ProvenanceAgent;
}): BatchInputPostRequest<Provenance>[] {
  const claimIds = new Set([matchedClaimId(before), matchedClaimId(after)].filter((id): id is string => !!id));
  return [...claimIds].flatMap((claimId) => {
    const provenance = claimEventProvenanceRequest({
      targetReference: `ClaimResponse/${before.id}`,
      claimId,
      before,
      after,
      agent,
      activity: 'update',
    });
    return provenance ? [provenance] : [];
  });
}
