import { Claim, ClaimResponse } from 'fhir/r4b';
import { describe, expect, it, Mock, vi } from 'vitest';
import { performEffect as matchClaimResponse } from '../../../src/billing/match-claim-response';
import { performEffect as unmatchClaimResponse } from '../../../src/billing/unmatch-claim-response';
import { OystehrMock } from '../../helpers/oystehr-mock';
import { claimHistoryEntries, provenanceChanges, TEST_AGENT } from './claim-history-fixtures';
import { claimResponse } from './era-fixtures';

vi.mock('../../../src/billing/era-write', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  assertClaimResponseEraNotVoided: vi.fn(),
}));

const claim: Claim = {
  resourceType: 'Claim',
  id: 'c2',
  status: 'active',
  use: 'claim',
  created: '2026-08-15',
  type: {
    coding: [
      {
        code: 'professional',
      },
    ],
  },
  patient: {
    reference: 'Patient/p2',
  },
  provider: {
    reference: 'Organization/org-1',
  },
  insurer: {
    reference: 'Organization/payer-1',
  },
  priority: {
    coding: [],
  },
  insurance: [],
};

const unmatchedResponse = claimResponse({
  request: {
    reference: '#request',
  },
  contained: [
    {
      resourceType: 'Claim',
      id: 'request',
      status: 'active',
      use: 'claim',
      created: '2026-08-15',
      type: {
        coding: [],
      },
      patient: {
        reference: '#patient',
      },
      provider: {
        reference: '#provider',
      },
      priority: {
        coding: [],
      },
      insurance: [],
    },
    {
      resourceType: 'Patient',
      id: 'patient',
    },
  ],
});

function makeClient(stored: ClaimResponse): { oystehr: OystehrMock; transaction: Mock } {
  const transaction = vi.fn().mockResolvedValue({
    unbundle: () => [stored],
  });
  const get = vi.fn(async ({ resourceType }: { resourceType: string }) => (resourceType === 'Claim' ? claim : stored));
  return {
    oystehr: {
      fhir: {
        get,
        transaction,
      },
    } as unknown as OystehrMock,
    transaction,
  };
}

const historyOf = (transaction: Mock): ReturnType<typeof claimHistoryEntries> =>
  claimHistoryEntries(transaction.mock.calls[0][0].requests);

const claimTargets = (transaction: Mock): (string | undefined)[] =>
  historyOf(transaction).map((entry) => entry.target?.[1]?.reference);

const matchedClaimChange = (transaction: Mock): unknown =>
  provenanceChanges(historyOf(transaction)[0]).find((change) => change.field === 'matchedClaim');

describe('match-claim-response', () => {
  it("records the match in the claim's history, by the biller who made it", async () => {
    const { oystehr, transaction } = makeClient(unmatchedResponse);

    await matchClaimResponse(oystehr, {
      claimId: 'c2',
      claimResponseId: 'cr-1',
      secrets: null,
      agent: TEST_AGENT,
    });

    expect(claimTargets(transaction)).toEqual(['Claim/c2']);
    expect(historyOf(transaction)[0]).toMatchObject({
      target: [
        {
          reference: 'ClaimResponse/cr-1',
        },
        {
          reference: 'Claim/c2',
        },
      ],
      agent: [TEST_AGENT],
    });
    expect(matchedClaimChange(transaction)).toEqual({
      field: 'matchedClaim',
      label: 'Matched Claim',
      previousValue: null,
      newValue: 'c2',
    });
  });

  it('patches the response to point at the claim, keeping the payer the ERA reported', async () => {
    const { oystehr, transaction } = makeClient(unmatchedResponse);

    await matchClaimResponse(oystehr, {
      claimId: 'c2',
      claimResponseId: 'cr-1',
      secrets: null,
      agent: TEST_AGENT,
    });

    const [patch] = transaction.mock.calls[0][0].requests;
    expect(JSON.parse(atob(patch.resource.data))).toEqual([
      {
        op: 'replace',
        path: '/request',
        value: {
          reference: 'Claim/c2',
        },
      },
      {
        op: 'replace',
        path: '/patient',
        value: claim.patient,
      },
      {
        op: 'replace',
        path: '/type',
        value: claim.type,
      },
    ]);
  });

  it("records a move between claims in both claims' history", async () => {
    const { oystehr, transaction } = makeClient(claimResponse());

    await matchClaimResponse(oystehr, {
      claimId: 'c2',
      claimResponseId: 'cr-1',
      secrets: null,
      agent: TEST_AGENT,
    });

    expect(claimTargets(transaction)).toEqual(['Claim/c1', 'Claim/c2']);
    expect(matchedClaimChange(transaction)).toEqual({
      field: 'matchedClaim',
      label: 'Matched Claim',
      previousValue: 'c1',
      newValue: 'c2',
    });
  });
});

describe('unmatch-claim-response', () => {
  it('records the unmatch in the history of the claim it leaves', async () => {
    const { oystehr, transaction } = makeClient(
      claimResponse({
        contained: unmatchedResponse.contained,
      })
    );

    await unmatchClaimResponse(oystehr, {
      claimResponseId: 'cr-1',
      secrets: null,
      agent: TEST_AGENT,
    });

    expect(claimTargets(transaction)).toEqual(['Claim/c1']);
    expect(matchedClaimChange(transaction)).toEqual({
      field: 'matchedClaim',
      label: 'Matched Claim',
      previousValue: 'c1',
      newValue: null,
    });
  });

  it('records nothing for a response that was not matched', async () => {
    const { oystehr, transaction } = makeClient(unmatchedResponse);

    await unmatchClaimResponse(oystehr, {
      claimResponseId: 'cr-1',
      secrets: null,
      agent: TEST_AGENT,
    });

    expect(historyOf(transaction)).toEqual([]);
  });
});
