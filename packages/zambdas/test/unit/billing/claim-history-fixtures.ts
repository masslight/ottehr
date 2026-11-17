import { Coding, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL, ClaimFieldChange } from 'utils/lib/types/data/billing/claim-history';
import { expect } from 'vitest';

export const TEST_AGENT: ProvenanceAgent = {
  who: {
    reference: 'Practitioner/user-id',
  },
};

// The transaction request writing the claim history entry for a change to `target`.
export const claimHistoryRequest = ({
  target,
  claimId,
  activity,
}: {
  target: string;
  claimId: string;
  activity: Coding;
}): unknown => ({
  method: 'POST',
  url: '/Provenance',
  resource: expect.objectContaining({
    target: [
      {
        reference: target,
      },
      {
        reference: `Claim/${claimId}`,
      },
    ],
    activity: {
      coding: [activity],
    },
    agent: [TEST_AGENT],
  }),
});

const isClaimHistoryEntry = (resource: Provenance | undefined): resource is Provenance =>
  !!resource?.extension?.some((extension) => extension.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL);

// Other Provenances can ride in the same transaction, like a manual remit's era-processing record.
export function claimHistoryEntries(requests: { method: string; url: string; resource?: unknown }[]): Provenance[] {
  return requests.flatMap((request) => {
    const resource = request.resource as Provenance | undefined;
    return request.method === 'POST' && request.url === '/Provenance' && isClaimHistoryEntry(resource)
      ? [resource]
      : [];
  });
}

export function provenanceChanges(provenance: Provenance): ClaimFieldChange[] {
  const diff = provenance.extension?.find((extension) => extension.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL);
  return JSON.parse(diff?.valueString ?? '[]');
}

export function historyChanges(requests: { method: string; url: string; resource?: unknown }[]): ClaimFieldChange[] {
  const [entry] = claimHistoryEntries(requests);
  if (!entry) throw new Error('The transaction writes no claim history entry');
  return provenanceChanges(entry);
}
