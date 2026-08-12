import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, ClaimResponseItemAdjudication, PaymentNotice } from 'fhir/r4b';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { describe, expect, it, Mock, vi } from 'vitest';
import {
  ADJUDICATION_CODES,
  ClaimPaymentSummary,
  countEraClaims,
  extractClaimResponseAmounts,
  extractRemitAdjustments,
  fetchPatientPaidByClaimId,
  fetchPatientPaymentsByEncounterIds,
  isMatchedToClaim,
  OYSTEHR_ADJUDICATION_SYSTEM,
  sortClaimResponsesByRecency,
  summarizeClaimPayments,
  summarizePatientBalance,
  sumPatientPayments,
  toClaimPatientPayment,
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

const casAdjustment = (group: string, amount: number, reasonCode?: string): ClaimResponseItemAdjudication => ({
  ...adjudication(group, amount, X12_ADJUSTMENT_GROUP_SYSTEM),
  ...(reasonCode
    ? {
        reason: {
          coding: [
            {
              system: 'https://x12.org/codes/claim-adjustment-reason-codes',
              code: reasonCode,
            },
          ],
        },
      }
    : {}),
});

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

const paymentNotice = (opts: {
  id: string;
  encounterId: string;
  amount: number;
  method?: string;
  paymentDate?: string;
  created?: string;
  disposition?: string;
  checkNumber?: string;
  withReconciliation?: boolean;
  status?: PaymentNotice['status'];
}): PaymentNotice =>
  ({
    resourceType: 'PaymentNotice',
    id: opts.id,
    status: opts.status ?? 'active',
    created: opts.created ?? '2026-07-01T12:00:00Z',
    amount: {
      value: opts.amount,
      currency: 'USD',
    },
    ...(opts.paymentDate
      ? {
          paymentDate: opts.paymentDate,
        }
      : {}),
    request: {
      type: 'Claim',
      identifier: {
        system: ottehrIdentifierSystem('claim-encounter-id'),
        value: opts.encounterId,
      },
    },
    extension: [
      {
        url: PAYMENT_METHOD_EXTENSION_URL,
        valueString: opts.method ?? 'cash',
      },
    ],
    ...(opts.withReconciliation === false
      ? {}
      : {
          contained: [
            {
              resourceType: 'PaymentReconciliation',
              id: 'contained-reconciliation',
              status: 'active',
              created: opts.created ?? '2026-07-01T12:00:00Z',
              paymentDate: opts.paymentDate ?? '2026-07-01',
              paymentAmount: {
                value: opts.amount,
                currency: 'USD',
              },
              disposition: opts.disposition ?? 'cash payment collected manually',
              ...(opts.checkNumber
                ? {
                    paymentIdentifier: {
                      system: 'https://fhir.ottehr.com/Identifier/check-number',
                      value: opts.checkNumber,
                    },
                  }
                : {}),
            },
          ],
        }),
  }) as PaymentNotice;

describe('extractRemitAdjustments', () => {
  it('returns CAS adjustments with group, reason, and amount, skipping payment adjudications', () => {
    const cr = claimResponse('2026-01-01', {
      itemAdjudications: [
        [
          adjudication('charge', 100),
          adjudication(ADJUDICATION_CODES.PAID, 60),
          adjudication(ADJUDICATION_CODES.ALLOWED, 80),
          casAdjustment('PR', 15, '1'),
          casAdjustment('CO', 20, '45'),
        ],
      ],
      addItemAdjudications: [[casAdjustment('PR', 5, '3')]],
    });
    expect(extractRemitAdjustments(cr)).toEqual([
      {
        groupCode: 'PR',
        reasonCode: '1',
        amount: 15,
      },
      {
        groupCode: 'CO',
        reasonCode: '45',
        amount: 20,
      },
      {
        groupCode: 'PR',
        reasonCode: '3',
        amount: 5,
      },
    ]);
  });

  it('returns an empty reason code when the adjustment carries none', () => {
    const cr = claimResponse('2026-01-01', {
      itemAdjudications: [[casAdjustment('OA', 10)]],
    });
    expect(extractRemitAdjustments(cr)).toEqual([
      {
        groupCode: 'OA',
        reasonCode: '',
        amount: 10,
      },
    ]);
  });

  it('returns empty when the response has no CAS adjustments', () => {
    const cr = claimResponse('2026-01-01', {
      totalPaid: 60,
      itemAdjudications: [[adjudication(ADJUDICATION_CODES.PAID, 60)]],
    });
    expect(extractRemitAdjustments(cr)).toEqual([]);
  });
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

  it('subtracts patientPaid from billed for an un-adjudicated claim', () => {
    expect(summarizeClaimPayments([], 150, 40)).toEqual({
      allowed: 0,
      insurancePaid: 0,
      patientResp: 0,
      patientPaid: 40,
      balance: 110,
      adjudicated: false,
    });
  });

  it('subtracts patientPaid from patient responsibility for an adjudicated claim', () => {
    expect(summarizeClaimPayments([claimMdClaimResponse()], 100, 15)).toEqual({
      allowed: 80,
      insurancePaid: 60,
      patientResp: 20,
      patientPaid: 15,
      balance: 5,
      adjudicated: true,
    });
  });

  it('does not double-subtract patientPaid in the fallback patient-responsibility branch', () => {
    const primary = claimMdClaimResponse('2026-01-01');
    const bareSecondary = claimResponse('2026-02-01', { totalPaid: 10 });
    const summary = summarizeClaimPayments([primary, bareSecondary], 100, 4);
    // responsibility stays allowed - insurancePaid (80 - 70); only the balance nets out the payment
    expect(summary.patientResp).toBe(10);
    expect(summary.balance).toBe(6);
  });
});

const summary = (over: Partial<ClaimPaymentSummary>): ClaimPaymentSummary => ({
  allowed: 0,
  insurancePaid: 0,
  patientResp: 0,
  patientPaid: 0,
  balance: 0,
  adjudicated: false,
  ...over,
});

describe('summarizePatientBalance', () => {
  it('counts a payment on an un-adjudicated claim as a credit, not a balance owed', () => {
    const result = summarizePatientBalance([
      summary({
        adjudicated: false,
        patientPaid: 14.69,
        balance: -14.69,
      }),
    ]);
    expect(result.currentBalance).toBe(-14.69);
    expect(result.claimsWithPatientBalance).toBe(0);
    expect(result.pendingPayments).toBe(0);
  });

  it('counts an adjudicated claim with an outstanding patient balance', () => {
    const result = summarizePatientBalance([
      summary({
        adjudicated: true,
        patientResp: 20,
        patientPaid: 5,
        balance: 15,
      }),
    ]);
    expect(result.currentBalance).toBe(15);
    expect(result.claimsWithPatientBalance).toBe(1);
  });

  it('ignores un-adjudicated billed amounts but nets payments across claims', () => {
    const result = summarizePatientBalance([
      // billed pending insurance, no payment, must not count toward the patient
      summary({
        adjudicated: false,
        balance: 200,
      }),
      // prepaid credit on an un-adjudicated claim
      summary({
        adjudicated: false,
        patientPaid: 30,
        balance: -30,
      }),
      // adjudicated amount the patient still owes
      summary({
        adjudicated: true,
        patientResp: 40,
        balance: 40,
      }),
    ]);
    expect(result.currentBalance).toBe(10);
    expect(result.claimsWithPatientBalance).toBe(1);
  });

  it('does not count a fully paid claim as outstanding when its balance is float residue', () => {
    const patientResp = 0.1 + 0.2;
    const result = summarizePatientBalance([
      summary({
        adjudicated: true,
        patientResp,
        patientPaid: 0.3,
        balance: patientResp - 0.3,
      }),
    ]);
    expect(result.claimsWithPatientBalance).toBe(0);
    expect(result.currentBalance).toBe(0);
  });

  it('keeps the running total at cent precision', () => {
    const result = summarizePatientBalance([
      summary({
        adjudicated: true,
        balance: 0.1,
      }),
      summary({
        adjudicated: true,
        balance: 0.2,
      }),
    ]);
    expect(result.currentBalance).toBe(0.3);
  });
});

describe('sumPatientPayments', () => {
  it('sums payment amounts', () => {
    const notices = [
      paymentNotice({
        id: 'a',
        encounterId: 'e',
        amount: 25,
      }),
      paymentNotice({
        id: 'b',
        encounterId: 'e',
        amount: 15,
      }),
    ];
    expect(sumPatientPayments(notices)).toBe(40);
  });

  it('nets refunds recorded as negative amounts', () => {
    const notices = [
      paymentNotice({
        id: 'a',
        encounterId: 'e',
        amount: 30,
      }),
      paymentNotice({
        id: 'r',
        encounterId: 'e',
        amount: -12,
      }),
    ];
    expect(sumPatientPayments(notices)).toBe(18);
  });

  it('returns 0 for no payments', () => {
    expect(sumPatientPayments([])).toBe(0);
  });

  it('ignores a cancelled refund, which the webhook writes for a refund that never went through', () => {
    const notices = [
      paymentNotice({
        id: 'a',
        encounterId: 'e',
        amount: 100,
      }),
      paymentNotice({
        id: 'r-failed',
        encounterId: 'e',
        amount: -40,
        status: 'cancelled',
      }),
    ];
    expect(sumPatientPayments(notices)).toBe(100);
  });

  it('ignores draft and entered-in-error notices', () => {
    const notices = [
      paymentNotice({
        id: 'a',
        encounterId: 'e',
        amount: 25,
      }),
      paymentNotice({
        id: 'b',
        encounterId: 'e',
        amount: 15,
        status: 'draft',
      }),
      paymentNotice({
        id: 'c',
        encounterId: 'e',
        amount: 10,
        status: 'entered-in-error',
      }),
    ];
    expect(sumPatientPayments(notices)).toBe(25);
  });
});

describe('toClaimPatientPayment', () => {
  it('maps a notice with a contained reconciliation', () => {
    const notice = paymentNotice({
      id: 'pn-1',
      encounterId: 'enc-1',
      amount: 25,
      method: 'check',
      paymentDate: '2026-07-10',
      disposition: 'check collected at front desk',
      checkNumber: '1234',
    });
    expect(toClaimPatientPayment(notice)).toEqual({
      paymentNoticeId: 'pn-1',
      paymentDate: '2026-07-10',
      amount: 25,
      method: 'check',
      description: 'check collected at front desk',
      checkNumber: '1234',
      status: 'active',
    });
  });

  it('falls back to created and leaves optional fields empty without a contained reconciliation', () => {
    const notice = paymentNotice({
      id: 'pn-2',
      encounterId: 'enc-2',
      amount: 10,
      method: 'card',
      created: '2026-07-05T09:00:00Z',
      withReconciliation: false,
    });
    expect(toClaimPatientPayment(notice)).toEqual({
      paymentNoticeId: 'pn-2',
      paymentDate: '2026-07-05T09:00:00Z',
      amount: 10,
      method: 'card',
      description: '',
      checkNumber: undefined,
      status: 'active',
    });
  });
});

describe('fetchPatientPaymentsByEncounterIds', () => {
  it('queries request:identifier as comma-separated system|value and groups by encounter id', async () => {
    const system = ottehrIdentifierSystem('claim-encounter-id');
    const notices = [
      paymentNotice({
        id: 'pn-1',
        encounterId: 'enc-1',
        amount: 10,
      }),
      paymentNotice({
        id: 'pn-2',
        encounterId: 'enc-2',
        amount: 20,
      }),
      paymentNotice({
        id: 'pn-3',
        encounterId: 'enc-1',
        amount: 5,
      }),
    ];
    const search = vi.fn().mockResolvedValue({
      unbundle: () => notices,
      link: [],
    });
    const oystehr = {
      fhir: {
        search,
      },
    } as unknown as Oystehr;

    const result = await fetchPatientPaymentsByEncounterIds(oystehr, ['enc-1', 'enc-2']);

    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0].params[0]).toEqual({
      name: 'request:identifier',
      value: `${system}|enc-1,${system}|enc-2`,
    });
    expect(result.get('enc-1')?.map((notice) => notice.id)).toEqual(['pn-1', 'pn-3']);
    expect(result.get('enc-2')?.map((notice) => notice.id)).toEqual(['pn-2']);
  });
});

describe('fetchPatientPaidByClaimId', () => {
  const claimForEncounter = (id: string, encounterId?: string): Claim =>
    ({
      resourceType: 'Claim',
      id,
      ...(encounterId
        ? {
            identifier: [
              {
                system: ottehrIdentifierSystem('claim-encounter-id'),
                value: encounterId,
              },
            ],
          }
        : {}),
    }) as Claim;

  const clientReturning = (
    notices: PaymentNotice[]
  ): {
    oystehr: Oystehr;
    search: Mock;
  } => {
    const search = vi.fn().mockResolvedValue({
      unbundle: () => notices,
      link: [],
    });
    return {
      oystehr: {
        fhir: {
          search,
        },
      } as unknown as Oystehr,
      search,
    };
  };

  it('totals each claim payments via its encounter identifier', async () => {
    const { oystehr } = clientReturning([
      paymentNotice({
        id: 'pn-1',
        encounterId: 'enc-1',
        amount: 40,
      }),
      paymentNotice({
        id: 'pn-2',
        encounterId: 'enc-1',
        amount: 10,
      }),
      paymentNotice({
        id: 'pn-3',
        encounterId: 'enc-2',
        amount: 25,
      }),
    ]);

    const result = await fetchPatientPaidByClaimId({
      oystehr,
      claims: [claimForEncounter('claim-1', 'enc-1'), claimForEncounter('claim-2', 'enc-2')],
    });

    expect(result.get('claim-1')).toBe(50);
    expect(result.get('claim-2')).toBe(25);
  });

  it('skips claims without an encounter identifier and never searches when none have one', async () => {
    const { oystehr, search } = clientReturning([]);

    const result = await fetchPatientPaidByClaimId({
      oystehr,
      claims: [claimForEncounter('claim-1')],
    });

    expect(search).not.toHaveBeenCalled();
    expect(result.has('claim-1')).toBe(false);
  });

  it('excludes cancelled notices from the per-claim total', async () => {
    const { oystehr } = clientReturning([
      paymentNotice({
        id: 'pn-charge',
        encounterId: 'enc-1',
        amount: 100,
      }),
      paymentNotice({
        id: 'pn-refund-failed',
        encounterId: 'enc-1',
        amount: -40,
        status: 'cancelled',
      }),
    ]);

    const result = await fetchPatientPaidByClaimId({
      oystehr,
      claims: [claimForEncounter('claim-1', 'enc-1')],
    });

    expect(result.get('claim-1')).toBe(100);
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
