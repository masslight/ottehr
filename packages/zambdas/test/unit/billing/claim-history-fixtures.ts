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

export function historyChanges(requests: { url: string; resource?: Provenance }[]): ClaimFieldChange[] {
  const provenance = requests.find((request) => request.url === '/Provenance')?.resource;
  const diff = provenance?.extension?.find((extension) => extension.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL);
  if (!diff?.valueString) throw new Error('The transaction writes no claim history entry');
  return JSON.parse(diff.valueString);
}
