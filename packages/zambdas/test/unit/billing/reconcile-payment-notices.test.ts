import Oystehr from '@oystehr/sdk';
import { Claim, PaymentNotice } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { describe, expect, it, vi } from 'vitest';
import { reconcilePaymentNoticesForClaim } from '../../../src/billing/shared';

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

interface FakeOystehr {
  fhir: {
    search: ReturnType<typeof vi.fn>;
    batch: ReturnType<typeof vi.fn>;
  };
}

const makeOystehr = (notices: PaymentNotice[]): FakeOystehr => ({
  fhir: {
    search: vi.fn().mockResolvedValue({ unbundle: () => notices }),
    batch: vi.fn().mockResolvedValue({
      entry: [
        {
          response: {
            outcome: {
              id: 'ok',
            },
          },
        },
      ],
    }),
  },
});

// getPatchBinary base64-encodes the JSON patch operations into resource.data
const decodePatchOps = (request: {
  resource: {
    data: string;
  };
}): unknown => JSON.parse(Buffer.from(request.resource.data, 'base64').toString('utf8'));

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
    const oystehr = makeOystehr([makeNotice('pn-unlinked'), makeNotice('pn-linked', 'Claim/claim-1')]);

    await reconcilePaymentNoticesForClaim(oystehr as unknown as Oystehr, makeClaim());

    expect(oystehr.fhir.batch).toHaveBeenCalledTimes(1);
    const requests = oystehr.fhir.batch.mock.calls[0][0].requests;
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('PATCH');
    expect(requests[0].url).toBe('/PaymentNotice/pn-unlinked');
    expect(decodePatchOps(requests[0])).toEqual([
      {
        op: 'add',
        path: '/request/reference',
        value: 'Claim/claim-1',
      },
    ]);
  });

  it('does not patch when every notice is already linked', async () => {
    const oystehr = makeOystehr([makeNotice('pn-linked', 'Claim/claim-1')]);

    await reconcilePaymentNoticesForClaim(oystehr as unknown as Oystehr, makeClaim());

    expect(oystehr.fhir.batch).not.toHaveBeenCalled();
  });

  it('returns early without searching when the claim has no encounter identifier', async () => {
    const oystehr = makeOystehr([]);

    await reconcilePaymentNoticesForClaim(oystehr as unknown as Oystehr, makeClaim({ identifier: [] }));

    expect(oystehr.fhir.search).not.toHaveBeenCalled();
  });
});
