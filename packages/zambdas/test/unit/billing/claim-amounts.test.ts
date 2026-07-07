import { ClaimResponse, ClaimResponseItemAdjudication } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  ADJUDICATION_CODES,
  countEraClaims,
  extractClaimResponseAmounts,
  isMatchedToClaim,
  OYSTEHR_ADJUDICATION_SYSTEM,
  sortClaimResponsesByRecency,
  summarizeClaimPayments,
  X12_ADJUSTMENT_GROUP_SYSTEM,
} from '../../../src/billing/claim-amounts';

const adjudication = (
  code: string,
  amount: number,
  system = OYSTEHR_ADJUDICATION_SYSTEM
): ClaimResponseItemAdjudication => ({
  category: {
    coding: [
      {
        system,
        code,
      },
    ],
  },
  amount: {
    value: amount,
    currency: 'USD',
  },
});

const casAdjustment = (group: string, amount: number): ClaimResponseItemAdjudication =>
  adjudication(group, amount, X12_ADJUSTMENT_GROUP_SYSTEM);

const claimResponse = (
  created: string,
  parts: {
    totalPaid?: number;
    totalCharge?: number;
    itemAdjudications?: ClaimResponseItemAdjudication[][];
    addItemAdjudications?: ClaimResponseItemAdjudication[][];
    lastUpdated?: string;
  }
): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  status: 'active',
  type: {
    coding: [
      {
        code: 'professional',
      },
    ],
  },
  use: 'claim',
  patient: {
    reference: 'Patient/p1',
  },
  created,
  insurer: {
    display: 'Test Payer',
  },
  outcome: 'complete',
  request: {
    reference: 'Claim/c1',
  },
  ...(parts.lastUpdated
    ? {
        meta: {
          lastUpdated: parts.lastUpdated,
        },
      }
    : {}),
  ...(parts.totalPaid !== undefined || parts.totalCharge !== undefined
    ? {
        total: [
          ...(parts.totalCharge !== undefined
            ? [
                {
                  category: {
                    coding: [
                      {
                        system: OYSTEHR_ADJUDICATION_SYSTEM,
                        code: 'charge',
                      },
                    ],
                  },
                  amount: {
                    value: parts.totalCharge,
                    currency: 'USD',
                  },
                },
              ]
            : []),
          ...(parts.totalPaid !== undefined
            ? [
                {
                  category: {
                    coding: [
                      {
                        system: OYSTEHR_ADJUDICATION_SYSTEM,
                        code: ADJUDICATION_CODES.PAID,
                      },
                    ],
                  },
                  amount: {
                    value: parts.totalPaid,
                    currency: 'USD',
                  },
                },
              ]
            : []),
        ],
      }
    : {}),
  ...(parts.itemAdjudications
    ? {
        item: parts.itemAdjudications.map((adjudications, idx) => ({
          itemSequence: idx + 1,
          adjudication: adjudications,
        })),
      }
    : {}),
  ...(parts.addItemAdjudications
    ? {
        addItem: parts.addItemAdjudications.map((adjudications) => ({
          productOrService: {
            coding: [
              {
                code: 'unknown',
              },
            ],
          },
          adjudication: adjudications,
        })),
      }
    : {}),
});

// item adjudications carry charge/paid/allowed plus per-item CAS adjustments
const claimMdClaimResponse = (created = '2026-01-01'): ClaimResponse =>
  claimResponse(created, {
    totalCharge: 100,
    totalPaid: 60,
    itemAdjudications: [
      [
        adjudication('charge', 100),
        adjudication(ADJUDICATION_CODES.PAID, 60),
        adjudication(ADJUDICATION_CODES.ALLOWED, 80),
        casAdjustment('PR', 20),
        casAdjustment('CO', 20),
      ],
    ],
  });

// allowed arrives as raw AMT qualifier B6 claim-level CAS land in addItem
const processEraClaimResponse = (created = '2026-01-01'): ClaimResponse =>
  claimResponse(created, {
    totalCharge: 100,
    totalPaid: 60,
    itemAdjudications: [
      [
        adjudication('charge', 100),
        adjudication(ADJUDICATION_CODES.PAID, 60),
        adjudication(ADJUDICATION_CODES.ALLOWED_X12, 80),
        casAdjustment('PR', 15),
        casAdjustment('CO', 20),
      ],
    ],
    addItemAdjudications: [[casAdjustment('PR', 5)]],
  });

describe('extractClaimResponseAmounts', () => {
  it('reads paid from the total, allowed and PR from item adjudications (Claim.MD shape)', () => {
    expect(extractClaimResponseAmounts(claimMdClaimResponse())).toEqual({
      paid: 60,
      allowed: 80,
      patientResp: 20,
    });
  });

  it('reads allowed from B6 and sums PR across item and addItem (process-era shape)', () => {
    expect(extractClaimResponseAmounts(processEraClaimResponse())).toEqual({
      paid: 60,
      allowed: 80,
      patientResp: 20,
    });
  });

  it('sums allowed, paid, and PR across multiple service lines', () => {
    const cr = claimResponse('2026-01-01', {
      itemAdjudications: [
        [
          adjudication(ADJUDICATION_CODES.PAID, 40),
          adjudication(ADJUDICATION_CODES.ALLOWED, 50),
          casAdjustment('PR', 10),
        ],
        [
          adjudication(ADJUDICATION_CODES.PAID, 20),
          adjudication(ADJUDICATION_CODES.ALLOWED, 30),
          casAdjustment('PR', 10),
        ],
      ],
    });
    expect(extractClaimResponseAmounts(cr)).toEqual({
      paid: 60,
      allowed: 80,
      patientResp: 20,
    });
  });

  it('falls back to summing item paid when there is no paid total', () => {
    const cr = claimResponse('2026-01-01', {
      itemAdjudications: [[adjudication(ADJUDICATION_CODES.PAID, 25)], [adjudication(ADJUDICATION_CODES.PAID, 35)]],
    });
    expect(extractClaimResponseAmounts(cr).paid).toBe(60);
  });

  it('sums multiple PR entries (e.g. deductible + coinsurance CAS lines)', () => {
    const cr = claimResponse('2026-01-01', {
      itemAdjudications: [[casAdjustment('PR', 12.5), casAdjustment('PR', 7.5), casAdjustment('CO', 30)]],
    });
    expect(extractClaimResponseAmounts(cr).patientResp).toBe(20);
  });

  it('returns undefined allowed when no allowed adjudication exists, but 0 PR when other CAS data exists', () => {
    const cr = claimResponse('2026-01-01', {
      totalPaid: 60,
      itemAdjudications: [[adjudication(ADJUDICATION_CODES.PAID, 60), casAdjustment('CO', 40)]],
    });
    expect(extractClaimResponseAmounts(cr)).toEqual({
      paid: 60,
      allowed: undefined,
      patientResp: 0,
    });
  });

  it('returns undefined allowed and patientResp when the response carries no adjudications at all', () => {
    const cr = claimResponse('2026-01-01', { totalPaid: 60 });
    expect(extractClaimResponseAmounts(cr)).toEqual({
      paid: 60,
      allowed: undefined,
      patientResp: undefined,
    });
  });
});

describe('summarizeClaimPayments', () => {
  it('reports the full billed amount as balance for un-adjudicated claims', () => {
    expect(summarizeClaimPayments([], 150)).toEqual({
      allowed: 0,
      insurancePaid: 0,
      patientResp: 0,
      patientPaid: 0,
      balance: 150,
      adjudicated: false,
    });
  });

  it('summarizes a single adjudication', () => {
    expect(summarizeClaimPayments([claimMdClaimResponse()], 100)).toEqual({
      allowed: 80,
      insurancePaid: 60,
      patientResp: 20,
      patientPaid: 0,
      balance: 20,
      adjudicated: true,
    });
  });

  it('sums insurance payments and takes patient responsibility from the latest adjudication', () => {
    const primary = claimMdClaimResponse('2026-01-01');
    const secondary = claimResponse('2026-02-01', {
      totalPaid: 15,
      itemAdjudications: [[adjudication(ADJUDICATION_CODES.PAID, 15), casAdjustment('PR', 5)]],
    });
    expect(summarizeClaimPayments([primary, secondary], 100)).toEqual({
      allowed: 80,
      insurancePaid: 75,
      patientResp: 5,
      patientPaid: 0,
      balance: 5,
      adjudicated: true,
    });
  });

  it('orders by created date regardless of input order', () => {
    const primary = claimMdClaimResponse('2026-01-01');
    const secondary = claimResponse('2026-02-01', {
      totalPaid: 15,
      itemAdjudications: [[adjudication(ADJUDICATION_CODES.PAID, 15), casAdjustment('PR', 5)]],
    });
    expect(summarizeClaimPayments([secondary, primary], 100)).toEqual(
      summarizeClaimPayments([primary, secondary], 100)
    );
  });

  it('breaks created-date ties by lastUpdated', () => {
    const original = claimResponse('2026-01-01', {
      totalPaid: 60,
      itemAdjudications: [[casAdjustment('PR', 20)]],
      lastUpdated: '2026-01-01T10:00:00Z',
    });
    const correction = claimResponse('2026-01-01', {
      totalPaid: 0,
      itemAdjudications: [[casAdjustment('PR', 30)]],
      lastUpdated: '2026-01-02T10:00:00Z',
    });
    expect(summarizeClaimPayments([correction, original], 100).patientResp).toBe(30);
  });

  it('nets out reversals with negative paid amounts', () => {
    const payment = claimMdClaimResponse('2026-01-01');
    const reversal = claimResponse('2026-02-01', {
      totalPaid: -60,
      itemAdjudications: [[adjudication(ADJUDICATION_CODES.PAID, -60), casAdjustment('PR', 0)]],
    });
    const summary = summarizeClaimPayments([payment, reversal], 100);
    expect(summary.insurancePaid).toBe(0);
    expect(summary.patientResp).toBe(0);
  });

  it('keeps allowed from the latest response that carries allowed data', () => {
    const primary = claimMdClaimResponse('2026-01-01');
    // secondary ERAs often carry no allowed amount of their own
    const secondary = claimResponse('2026-02-01', {
      totalPaid: 15,
      itemAdjudications: [[adjudication(ADJUDICATION_CODES.PAID, 15), casAdjustment('PR', 5)]],
    });
    expect(summarizeClaimPayments([primary, secondary], 100).allowed).toBe(80);
  });

  it('falls back to allowed minus insurance paid when the latest response has no adjudication data', () => {
    const primary = claimMdClaimResponse('2026-01-01');
    const bareSecondary = claimResponse('2026-02-01', { totalPaid: 10 });
    const summary = summarizeClaimPayments([primary, bareSecondary], 100);
    expect(summary.insurancePaid).toBe(70);
    expect(summary.patientResp).toBe(10);
    expect(summary.balance).toBe(10);
  });

  it('limits the fallback at zero when allowed is unknown', () => {
    const cr = claimResponse('2026-01-01', { totalPaid: 60 });
    const summary = summarizeClaimPayments([cr], 100);
    expect(summary.patientResp).toBe(0);
    expect(summary.balance).toBe(0);
  });
});

describe('isMatchedToClaim', () => {
  it('recognizes a real Claim reference as matched', () => {
    expect(isMatchedToClaim(claimMdClaimResponse())).toBe(true);
  });

  it('treats an unmatched contained #request reference as unmatched', () => {
    const unmatched: ClaimResponse = {
      ...claimMdClaimResponse(),
      request: {
        reference: '#request',
      },
    };
    expect(isMatchedToClaim(unmatched)).toBe(false);
  });

  it('treats a missing request as unmatched', () => {
    const withoutRequest: ClaimResponse = {
      ...claimMdClaimResponse(),
      request: undefined,
    };
    expect(isMatchedToClaim(withoutRequest)).toBe(false);
  });
});

describe('countEraClaims', () => {
  it('returns zeros for an ERA with no claim responses', () => {
    expect(countEraClaims([])).toEqual({
      total: 0,
      matched: 0,
      unmatched: 0,
    });
  });

  it('counts distinct claims when an ERA adjudicates the same claim twice', () => {
    // both fixtures reference Claim/c1 (e.g. a reversal + corrected payment in one remittance)
    expect(countEraClaims([claimMdClaimResponse('2026-01-01'), claimMdClaimResponse('2026-02-01')])).toEqual({
      total: 1,
      matched: 1,
      unmatched: 0,
    });
  });

  it('counts unmatched responses individually', () => {
    const unmatched: ClaimResponse = {
      ...claimMdClaimResponse(),
      request: {
        reference: '#request',
      },
    };
    expect(countEraClaims([claimMdClaimResponse(), unmatched, unmatched])).toEqual({
      total: 3,
      matched: 1,
      unmatched: 2,
    });
  });
});

describe('sortClaimResponsesByRecency', () => {
  it('orders by created, then lastUpdated, oldest first', () => {
    const jan = claimResponse('2026-01-01', { totalPaid: 1 });
    const febEarly = claimResponse('2026-02-01', {
      totalPaid: 2,
      lastUpdated: '2026-02-01T08:00:00Z',
    });
    const febLate = claimResponse('2026-02-01', {
      totalPaid: 3,
      lastUpdated: '2026-02-02T08:00:00Z',
    });
    const sorted = sortClaimResponsesByRecency([febLate, jan, febEarly]);
    expect(sorted.map((cr) => cr.total?.[0]?.amount?.value)).toEqual([1, 2, 3]);
  });

  it('does not mutate the input array', () => {
    const a = claimResponse('2026-02-01', { totalPaid: 1 });
    const b = claimResponse('2026-01-01', { totalPaid: 2 });
    const input = [a, b];
    sortClaimResponsesByRecency(input);
    expect(input).toEqual([a, b]);
  });
});
