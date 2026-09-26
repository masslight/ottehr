import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, PaymentReconciliation } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { describe, expect, it, vi } from 'vitest';
import { netCollectionsReport } from '../../../src/billing/reports/definitions/net-collections.report';
import { reportRegistry } from '../../../src/billing/reports/framework/registry';

vi.mock('../../../src/billing/claim-amounts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchClaimResponsesByPaymentReconciliations: vi.fn(),
}));
vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolvePayersByRef: vi.fn(),
}));
vi.mock('../../../src/billing/reports/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchAllEras: vi.fn(),
  fetchPartialClaimsById: vi.fn(),
}));
vi.mock('../../../src/billing/reports/definitions/patient-payments.report', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  patientNetCollections: vi.fn(),
}));

import { fetchClaimResponsesByPaymentReconciliations } from '../../../src/billing/claim-amounts';
import {
  ADJUDICATION_CODES,
  ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY,
  X12_ADJUSTMENT_GROUP_SYSTEM,
} from '../../../src/billing/claim-amounts';
import { patientNetCollections } from '../../../src/billing/reports/definitions/patient-payments.report';
import { fetchAllEras, fetchPartialClaimsById } from '../../../src/billing/reports/shared';
import { resolvePayersByRef } from '../../../src/billing/shared';

const era = (id: string, paymentDate: string, payerRef: string): PaymentReconciliation => ({
  resourceType: 'PaymentReconciliation',
  id,
  status: 'active',
  created: `${paymentDate}T00:00:00Z`,
  paymentDate,
  paymentAmount: { value: 0, currency: 'USD' },
  paymentIssuer: { reference: payerRef },
});

// real extractClaimResponseAmounts shapes: paid/allowed ride the totals; patient responsibility
// is a CAS item adjudication — omitting it entirely is the "no adjudication data" case.
// Matched to a real Claim by default; pass claimId: null for an unmatched remit row.
const claimResponse = (
  allowed: number,
  paid: number,
  patientResp?: number,
  claimId: string | null = 'claim-1'
): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  status: 'active',
  type: { text: 'professional' },
  use: 'claim',
  patient: {},
  created: '2026-01-05T00:00:00Z',
  insurer: {},
  outcome: 'complete',
  request: { reference: claimId === null ? '#request' : `Claim/${claimId}` },
  total: [
    { category: { coding: [{ code: ADJUDICATION_CODES.PAID }] }, amount: { value: paid, currency: 'USD' } },
    { category: { coding: [{ code: ADJUDICATION_CODES.ALLOWED }] }, amount: { value: allowed, currency: 'USD' } },
  ],
  ...(patientResp !== undefined
    ? {
        item: [
          {
            itemSequence: 1,
            adjudication: [
              {
                category: {
                  coding: [{ system: X12_ADJUSTMENT_GROUP_SYSTEM, code: ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY }],
                },
                amount: { value: patientResp, currency: 'USD' },
              },
            ],
          },
        ],
      }
    : {}),
});

const computeWith = async (input: {
  eras: PaymentReconciliation[];
  claimResponsesByEra: Record<string, ClaimResponse[]>;
  patient: { net: number; byMonth: Map<string, number> };
  params?: { dateFrom?: string; dateTo?: string };
  claimsById?: Map<string, Claim>;
}): Promise<Awaited<ReturnType<typeof netCollectionsReport.compute>>> => {
  vi.mocked(fetchAllEras).mockResolvedValue(input.eras);
  vi.mocked(fetchClaimResponsesByPaymentReconciliations).mockResolvedValue(
    new Map(Object.entries(input.claimResponsesByEra))
  );
  vi.mocked(resolvePayersByRef).mockResolvedValue(
    new Map([
      ['Organization/aetna', { resourceType: 'Organization', name: 'Aetna' }],
      ['Organization/bcbs', { resourceType: 'Organization', name: 'BCBS' }],
    ]) as never
  );
  vi.mocked(patientNetCollections).mockResolvedValue(input.patient);
  vi.mocked(fetchPartialClaimsById).mockResolvedValue(input.claimsById ?? new Map());
  const ctx = { oystehr: {} as Oystehr, untaggedClient: {} as Oystehr, secrets: null };
  return netCollectionsReport.compute(ctx, input.params ?? {}, async () => undefined);
};

describe('net-collections compute', () => {
  it('aggregates payers, months, and headline buckets from windowed ERAs and patient collections', async () => {
    const { payload } = await computeWith({
      eras: [
        era('era-1', '2026-01-10', 'Organization/aetna'),
        era('era-2', '2026-02-05', 'Organization/bcbs'),
        // outside the window: must not count anywhere
        era('era-3', '2026-03-20', 'Organization/aetna'),
      ],
      claimResponsesByEra: {
        'era-1': [claimResponse(100, 70, 20)],
        'era-2': [claimResponse(50, 40, 10)],
        'era-3': [claimResponse(999, 999, 0)],
      },
      patient: { net: 25, byMonth: new Map([['2026-01', 25]]) },
      params: { dateFrom: '2026-01-01', dateTo: '2026-02-28' },
    });

    // allowed 150, PR 30, paid 110, patient net 25
    expect(payload.insurance).toEqual({ collected: 110, expected: 120 });
    expect(payload.patient).toEqual({ collected: 25, expected: 30 });
    expect(payload.overall).toEqual({ collected: 135, expected: 150 });

    expect(payload.payerRows.map((row) => [row.payerName, row.expected, row.paid])).toEqual([
      ['Aetna', 80, 70],
      ['BCBS', 40, 40],
    ]);

    expect(payload.monthly).toEqual([
      { month: '2026-01', insurance: { collected: 70, expected: 80 }, patient: { collected: 25, expected: 20 } },
      { month: '2026-02', insurance: { collected: 40, expected: 40 }, patient: { collected: 0, expected: 10 } },
    ]);
  });

  it('falls back to allowed − paid (floored) when a ClaimResponse has no patient-responsibility data', async () => {
    const { payload } = await computeWith({
      eras: [era('era-1', '2026-01-10', 'Organization/aetna')],
      // allowed 80, paid 60, no CAS data → patientResp 20, insurance expected 60
      claimResponsesByEra: { 'era-1': [claimResponse(80, 60)] },
      patient: { net: 0, byMonth: new Map() },
    });

    expect(payload.insurance).toEqual({ collected: 60, expected: 60 });
    expect(payload.patient.expected).toBe(20);
    expect(payload.payerRows[0]).toMatchObject({ allowed: 80, patientResp: 20, expected: 60, paid: 60 });
  });

  it('excludes unmatched ClaimResponses and ERAs with no matched claims, passing matched keys to the patient side', async () => {
    const encounterClaim: Claim = {
      resourceType: 'Claim',
      id: 'claim-1',
      status: 'active',
      type: {},
      use: 'claim',
      patient: {},
      created: '2026-01-01',
      provider: {},
      priority: {},
      insurance: [],
      identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-1' }],
    };
    const { payload } = await computeWith({
      eras: [
        era('era-1', '2026-01-10', 'Organization/aetna'),
        // only unmatched remit rows: must produce no payer row and no month bucket
        era('era-2', '2026-01-12', 'Organization/bcbs'),
      ],
      claimResponsesByEra: {
        'era-1': [claimResponse(100, 70, 20), claimResponse(500, 400, 0, null)],
        'era-2': [claimResponse(200, 150, 50, null)],
      },
      patient: { net: 10, byMonth: new Map([['2026-01', 10]]) },
      claimsById: new Map([['claim-1', encounterClaim]]),
    });

    // only the matched CR counts: allowed 100, PR 20, paid 70
    expect(payload.insurance).toEqual({ collected: 70, expected: 80 });
    expect(payload.patient.expected).toBe(20);
    expect(payload.payerRows).toHaveLength(1);
    expect(payload.payerRows[0]).toMatchObject({ payerName: 'Aetna', claimCount: 1, allowed: 100, paid: 70 });

    expect(vi.mocked(patientNetCollections)).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      null,
      { claimIds: new Set(['claim-1']), encounterIds: new Set(['encounter-1']) },
      expect.any(Function)
    );
  });

  it('keeps a patient-collection month with no ERA responsibility as a zero-expected bucket', async () => {
    const { payload } = await computeWith({
      eras: [],
      claimResponsesByEra: {},
      patient: { net: -15, byMonth: new Map([['2026-04', -15]]) },
    });

    expect(payload.monthly).toEqual([
      { month: '2026-04', insurance: { collected: 0, expected: 0 }, patient: { collected: -15, expected: 0 } },
    ]);
    expect(payload.overall).toEqual({ collected: -15, expected: 0 });
  });
});

describe('net-collections report definition', () => {
  it('is registered and keys its cache by the date window', () => {
    expect(reportRegistry['net-collections']).toBe(netCollectionsReport);
    expect(netCollectionsReport.cacheKeyOf({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })).toBe(
      '2026-01-01:2026-01-31'
    );
    expect(netCollectionsReport.cacheKeyOf({})).toBe('all:all');
  });

  it('serves an all-zero empty payload', () => {
    const empty = netCollectionsReport.emptyPayload();
    expect(empty.overall).toEqual({ collected: 0, expected: 0 });
    expect(empty.insurance).toEqual({ collected: 0, expected: 0 });
    expect(empty.patient).toEqual({ collected: 0, expected: 0 });
    expect(empty.payerRows).toEqual([]);
    expect(empty.monthly).toEqual([]);
  });

  it('summarize reports the overall rate', () => {
    const summary = netCollectionsReport.summarize({
      overall: { collected: 942, expected: 1000 },
      insurance: { collected: 800, expected: 820 },
      patient: { collected: 142, expected: 180 },
      payerRows: [{}, {}] as never,
      monthly: [],
      generatedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(summary).toBe('net collections cached (94.2% overall, 2 payers)');
  });
});
