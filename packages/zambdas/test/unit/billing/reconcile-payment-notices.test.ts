import Oystehr from '@oystehr/sdk';
import { Claim, PaymentNotice, Provenance } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
} from 'utils/lib/types/data/billing/claim-history';
import { describe, expect, it, vi } from 'vitest';
import { reconcilePaymentNoticesForClaim } from '../../../src/billing/payments';

vi.mock('../../../src/billing/provenance', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveClaimActor: vi.fn(async () => ({
    who: {
      reference: 'Device/system',
    },
  })),
}));

const ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

const makeClaim = (overrides: Partial<Claim> = {}): Claim =>
  ({
    resourceType: 'Claim',
    id: 'claim-1',
    identifier: [
      {
        system: ENCOUNTER_ID_SYSTEM,
        value: 'enc-1',
      },
    ],
    ...overrides,
  }) as Claim;

const makeNotice = (id: string, requestReference?: string): PaymentNotice =>
  ({
    resourceType: 'PaymentNotice',
    id,
    status: 'active',
    request: {
      type: 'Claim',
      identifier: {
        system: ENCOUNTER_ID_SYSTEM,
        value: 'enc-1',
      },
      ...(requestReference
        ? {
            reference: requestReference,
          }
        : {}),
    },
  }) as PaymentNotice;

// a history entry written when the payment was taken, before its claim existed
const paymentEntry = (noticeId: string): Provenance =>
  ({
    resourceType: 'Provenance',
    id: `prov-${noticeId}`,
    target: [
      {
        reference: `PaymentNotice/${noticeId}`,
      },
    ],
    extension: [
      {
        url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
        valueString: '[]',
      },
    ],
  }) as Provenance;

interface FakeOystehr {
  fhir: {
    search: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
}

const makeOystehr = (notices: PaymentNotice[], provenances: Provenance[] = []): FakeOystehr => ({
  fhir: {
    search: vi.fn(async ({ resourceType }: { resourceType: string }) => ({
      unbundle: () => (resourceType === 'Provenance' ? provenances : notices),
    })),
    transaction: vi.fn().mockResolvedValue({}),
  },
});

// getPatchBinary base64-encodes the JSON patch operations into resource.data
const decodePatchOps = (request: {
  resource: {
    data: string;
  };
}): unknown => JSON.parse(Buffer.from(request.resource.data, 'base64').toString('utf8'));

const transactionRequests = (oystehr: FakeOystehr, call = 0): { method: string; url: string; resource?: unknown }[] =>
  oystehr.fhir.transaction.mock.calls[call][0].requests;

const historyLink = (provenanceId: string): unknown => ({
  method: 'PATCH',
  url: `/Provenance/${provenanceId}`,
  operations: [
    {
      op: 'add',
      path: '/target/-',
      value: {
        reference: 'Claim/claim-1',
      },
    },
  ],
});

describe('reconcilePaymentNoticesForClaim', () => {
  it('searches request:identifier with the system|value form', async () => {
    const oystehr = makeOystehr([]);

    await reconcilePaymentNoticesForClaim(oystehr as unknown as Oystehr, makeClaim());

    expect(oystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'PaymentNotice',
      params: [
        {
          name: 'request:identifier',
          value: `${ENCOUNTER_ID_SYSTEM}|enc-1`,
        },
      ],
    });
  });

  it('patches only unlinked notices to Claim/{id}', async () => {
    const oystehr = makeOystehr(
      [makeNotice('pn-unlinked'), makeNotice('pn-linked', 'Claim/claim-1')],
      [paymentEntry('pn-unlinked')]
    );

    await reconcilePaymentNoticesForClaim(oystehr as unknown as Oystehr, makeClaim());

    expect(oystehr.fhir.transaction).toHaveBeenCalledTimes(1);
    const noticePatches = transactionRequests(oystehr).filter((request) => request.url.startsWith('/PaymentNotice/'));
    expect(noticePatches).toHaveLength(1);
    expect(noticePatches[0].method).toBe('PATCH');
    expect(noticePatches[0].url).toBe('/PaymentNotice/pn-unlinked');
    expect(decodePatchOps(noticePatches[0] as { resource: { data: string } })).toEqual([
      {
        op: 'add',
        path: '/request/reference',
        value: 'Claim/claim-1',
      },
    ]);
  });

  it('adds the claim to the history entry written when the payment was taken', async () => {
    const oystehr = makeOystehr([makeNotice('pn-unlinked')], [paymentEntry('pn-unlinked')]);

    await reconcilePaymentNoticesForClaim(oystehr as unknown as Oystehr, makeClaim());

    expect(oystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'Provenance',
      params: expect.arrayContaining([
        {
          name: 'target',
          value: 'PaymentNotice/pn-unlinked',
        },
      ]),
    });
    expect(transactionRequests(oystehr)).toContainEqual(historyLink('prov-pn-unlinked'));
    expect(transactionRequests(oystehr).filter((request) => request.method === 'POST')).toEqual([]);
  });

  it('commits each notice with its own history, so one that fails leaves the others linked', async () => {
    const oystehr = makeOystehr([makeNotice('pn-a'), makeNotice('pn-b')], [paymentEntry('pn-a'), paymentEntry('pn-b')]);
    oystehr.fhir.transaction.mockRejectedValueOnce(new Error('conflict'));

    await reconcilePaymentNoticesForClaim(oystehr as unknown as Oystehr, makeClaim());

    expect(oystehr.fhir.transaction).toHaveBeenCalledTimes(2);
    [
      ['pn-a', 'prov-pn-a'],
      ['pn-b', 'prov-pn-b'],
    ].forEach(([noticeId, provenanceId], call) => {
      expect(transactionRequests(oystehr, call).map((request) => request.url)).toEqual([
        `/PaymentNotice/${noticeId}`,
        `/Provenance/${provenanceId}`,
      ]);
      expect(transactionRequests(oystehr, call)).toContainEqual(historyLink(provenanceId));
    });
  });

  it('records a notice stored before claim history was kept, attributed to the system', async () => {
    const oystehr = makeOystehr([makeNotice('pn-unlinked')]);

    await reconcilePaymentNoticesForClaim(oystehr as unknown as Oystehr, makeClaim());

    const entries = transactionRequests(oystehr).filter((request) => request.url === '/Provenance');
    expect(entries).toMatchObject([
      {
        method: 'POST',
        resource: {
          target: [
            {
              reference: 'PaymentNotice/pn-unlinked',
            },
            {
              reference: 'Claim/claim-1',
            },
          ],
          activity: {
            coding: [CLAIM_PROVENANCE_ACTIVITY.create],
          },
          agent: [
            {
              who: {
                reference: 'Device/system',
              },
            },
          ],
        },
      },
    ]);
  });

  it('does not patch when every notice is already linked', async () => {
    const oystehr = makeOystehr([makeNotice('pn-linked', 'Claim/claim-1')]);

    await reconcilePaymentNoticesForClaim(oystehr as unknown as Oystehr, makeClaim());

    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('returns early without searching when the claim has no encounter identifier', async () => {
    const oystehr = makeOystehr([]);

    await reconcilePaymentNoticesForClaim(oystehr as unknown as Oystehr, makeClaim({ identifier: [] }));

    expect(oystehr.fhir.search).not.toHaveBeenCalled();
  });
});
