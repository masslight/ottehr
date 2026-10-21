import { BatchInputPostRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { ClaimResponse, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { matchedClaimId } from './claim-amounts';
import { claimEventProvenanceRequest } from './provenance';

// What matching a payer response to a claim, or unmatching it, rewrites.
const MATCH_FIELDS = ['request', 'insurer', 'patient', 'type'] as const;

export function matchFieldsPatchOperations(claimResponse: ClaimResponse): Operation[] {
  return MATCH_FIELDS.map((field) => ({
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
