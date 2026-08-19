import { Claim, ClaimItem, ClaimResponse } from 'fhir/r4b';
import { AR_STAGE, ArStageCode, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { describe, expect, it } from 'vitest';
import { ADJUDICATION_CODES } from '../../../src/billing/claim-amounts';
import { computeBillingStatementAmounts } from '../../../src/shared/statements/get-billing-statement-lines';
import { adjudication, casAdjustment, claimResponse, eraItem } from '../billing/era-fixtures';

const XRAY = {
  sequence: 1,
  code: '73100',
  charge: 104,
};
const OFFICE_VISIT = {
  sequence: 2,
  code: '99203',
  charge: 339,
};

const claimItem = (parts: { sequence: number; code: string; charge: number }): ClaimItem => ({
  sequence: parts.sequence,
  productOrService: {
    coding: [
      {
        code: parts.code,
      },
    ],
  },
  net: {
    value: parts.charge,
    currency: 'USD',
  },
});

// A claim carries a real coverage and sits in patient AR, which is how one reaches a statement:
// insurance has finished with it. `arStage` overrides the stage to model a claim still with the payer.
const billingClaim = (
  options: {
    items?: { sequence: number; code: string; charge: number }[];
    arStage?: ArStageCode;
  } = {}
): Claim => {
  const { items = [XRAY, OFFICE_VISIT], arStage = AR_STAGE.patient } = options;
  return {
    resourceType: 'Claim',
    id: 'c1',
    status: 'active',
    created: '2026-08-01',
    use: 'claim',
    meta: {
      tag: [
        {
          system: CLAIM_STATUS_TAG_SYSTEMS.arStage,
          code: arStage,
        },
      ],
    },
    type: {
      coding: [],
    },
    priority: {
      coding: [],
    },
    patient: {
      reference: 'Patient/p1',
    },
    provider: {
      reference: 'Organization/prov-1',
    },
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: {
          reference: 'Coverage/cov-1',
        },
      },
    ],
    item: items.map(claimItem),
    total: {
      value: items.reduce((sum, item) => sum + item.charge, 0),
      currency: 'USD',
    },
  } as Claim;
};

// Both lines fully adjudicated: the payer pays part, writes part off, and leaves the rest with the
// patient as coinsurance. 104 = 55.32 + 28.68 + 20, and 339 = 200 + 71 + 68.
const fullyAdjudicatedRemit = (overrides: Partial<ClaimResponse> = {}): ClaimResponse =>
  claimResponse({
    item: [
      eraItem({
        sequence: 1,
        procedureCode: '73100',
        adjudication: [
          adjudication(ADJUDICATION_CODES.CHARGE, 104),
          adjudication(ADJUDICATION_CODES.PAID, 55.32),
          casAdjustment('CO', 28.68, '45'),
          casAdjustment('PR', 20, '2'),
        ],
      }),
      eraItem({
        sequence: 2,
        procedureCode: '99203',
        adjudication: [
          adjudication(ADJUDICATION_CODES.CHARGE, 339),
          adjudication(ADJUDICATION_CODES.PAID, 200),
          casAdjustment('CO', 71, '45'),
          casAdjustment('PR', 68, '2'),
        ],
      }),
    ],
    ...overrides,
  });

const sumOf = (amounts: { [key: string]: number }[], field: string): number =>
  amounts.reduce((total, amount) => total + amount[field], 0);

describe('computeBillingStatementAmounts', () => {
  it('reports the payer per-procedure amounts and settles the payment against them in order', () => {
    const amounts = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [fullyAdjudicatedRemit()],
      patientPaid: 50,
    });

    expect(amounts.totals).toEqual({
      // 443 billed less the 99.68 written off, which is what the payer recognized
      chargedCents: 34_332,
      insurancePaidCents: 25_532,
      patientPaidCents: 5000,
      balanceDueCents: 3800,
      deductibleCents: 0,
    });
    expect(amounts.lines).toEqual([
      {
        chargedCents: 7532,
        insurancePaidCents: 5532,
        patientPaidCents: 2000,
        patientOwesCents: 0,
      },
      {
        chargedCents: 26_800,
        insurancePaidCents: 20_000,
        patientPaidCents: 3000,
        patientOwesCents: 3800,
      },
    ]);
  });

  it('adds up the lines to the totals whatever the payer reported', () => {
    const cases = [
      {
        claimResponses: [fullyAdjudicatedRemit()],
        patientPaid: 50,
      },
      {
        claimResponses: [fullyAdjudicatedRemit()],
        patientPaid: 0,
      },
      {
        claimResponses: [fullyAdjudicatedRemit()],
        patientPaid: 120,
      },
      {
        claimResponses: [],
        patientPaid: 12.34,
      },
    ];

    for (const { claimResponses, patientPaid } of cases) {
      const { lines, totals } = computeBillingStatementAmounts({
        claim: billingClaim(),
        claimResponses,
        patientPaid,
      });

      expect(sumOf(lines, 'chargedCents')).toBe(totals.chargedCents);
      expect(sumOf(lines, 'insurancePaidCents')).toBe(totals.insurancePaidCents);
      expect(sumOf(lines, 'patientPaidCents')).toBe(totals.patientPaidCents);
      expect(sumOf(lines, 'patientOwesCents')).toBe(totals.balanceDueCents);
    }
  });

  it('spreads an amount the payer attached to the whole visit rather than to a procedure', () => {
    const remit = fullyAdjudicatedRemit({
      addItem: [
        {
          productOrService: {
            coding: [
              {
                code: 'unknown',
              },
            ],
          },
          adjudication: [casAdjustment('PR', 10, '3')],
        },
      ],
    });

    const { lines, totals } = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [remit],
      patientPaid: 0,
    });

    expect(totals.balanceDueCents).toBe(9800);
    // the extra 10 belongs to no procedure, so both carry it in proportion to their charges
    expect(lines.map((line) => line.patientOwesCents)).toEqual([2234, 7566]);
  });

  it('sums insurance payments across remits but takes responsibility from the latest', () => {
    const secondary = claimResponse({
      id: 'cr-2',
      created: '2026-08-20',
      item: [
        eraItem({
          sequence: 2,
          procedureCode: '99203',
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 15), casAdjustment('PR', 53, '2')],
        }),
      ],
    });

    const { lines, totals } = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [fullyAdjudicatedRemit(), secondary],
      patientPaid: 0,
    });

    expect(totals.insurancePaidCents).toBe(27_032);
    expect(totals.balanceDueCents).toBe(5300);
    expect(lines.map((line) => line.insurancePaidCents)).toEqual([5532, 21_500]);
    expect(lines.map((line) => line.patientOwesCents)).toEqual([0, 5300]);
  });

  it('keeps every amount at or above zero when a later remit reverses a payment it cannot trace', () => {
    // the payer takes its payment back under a procedure code the claim never carried, so the
    // reversal cannot be joined to a claim line and only counts toward the claim-level total
    const takeBack = claimResponse({
      id: 'cr-2',
      created: '2026-08-20',
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '99999',
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, -255.32), casAdjustment('PR', 88, '2')],
        }),
      ],
    });

    const { lines, totals } = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [fullyAdjudicatedRemit(), takeBack],
      patientPaid: 0,
    });

    expect(totals.insurancePaidCents).toBe(0);
    expect(totals.balanceDueCents).toBe(8800);
    expect(lines).toEqual([
      {
        chargedCents: 2065,
        insurancePaidCents: 0,
        patientPaidCents: 0,
        patientOwesCents: 2065,
      },
      {
        chargedCents: 6735,
        insurancePaidCents: 0,
        patientPaidCents: 0,
        patientOwesCents: 6735,
      },
    ]);
  });

  it('reads a fully reversed remit as nothing owed rather than as negative amounts', () => {
    const reversal = claimResponse({
      id: 'cr-2',
      created: '2026-08-20',
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '73100',
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, -55.32), casAdjustment('PR', -20, '2')],
        }),
        eraItem({
          sequence: 2,
          procedureCode: '99203',
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, -200), casAdjustment('PR', -68, '2')],
        }),
      ],
    });

    const { lines, totals } = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [fullyAdjudicatedRemit(), reversal],
      patientPaid: 0,
    });

    expect(totals).toEqual({
      chargedCents: 0,
      insurancePaidCents: 0,
      patientPaidCents: 0,
      balanceDueCents: 0,
      deductibleCents: 0,
    });
    expect(lines).toEqual([
      {
        chargedCents: 0,
        insurancePaidCents: 0,
        patientPaidCents: 0,
        patientOwesCents: 0,
      },
      {
        chargedCents: 0,
        insurancePaidCents: 0,
        patientPaidCents: 0,
        patientOwesCents: 0,
      },
    ]);
  });

  it('surfaces the deductible the payer applied', () => {
    const remit = claimResponse({
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '73100',
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 0), casAdjustment('PR', 104, '1')],
        }),
      ],
    });

    const { totals } = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [remit],
      patientPaid: 0,
    });

    expect(totals.deductibleCents).toBe(10_400);
    expect(totals.balanceDueCents).toBe(10_400);
  });

  it('drops the deductible back to zero when the payer reverses the one it applied', () => {
    const applied = claimResponse({
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '73100',
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 0), casAdjustment('PR', 104, '1')],
        }),
      ],
    });
    const reversal = claimResponse({
      id: 'cr-2',
      created: '2026-08-20',
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '73100',
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 0), casAdjustment('PR', -104, '1')],
        }),
      ],
    });

    const { totals } = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [applied, reversal],
      patientPaid: 0,
    });

    expect(totals.deductibleCents).toBe(0);
    expect(totals.balanceDueCents).toBe(0);
  });

  it('bills the whole visit to the patient once insurance has finished without a remit', () => {
    const { lines, totals } = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [],
      patientPaid: 0,
    });

    expect(totals).toEqual({
      chargedCents: 44_300,
      insurancePaidCents: 0,
      patientPaidCents: 0,
      balanceDueCents: 44_300,
      deductibleCents: 0,
    });
    expect(lines.map((line) => line.patientOwesCents)).toEqual([10_400, 33_900]);
  });

  it('owes the patient nothing while an insured claim is still waiting on its payer', () => {
    const { lines, totals } = computeBillingStatementAmounts({
      claim: billingClaim({ arStage: AR_STAGE.insurancePayer }),
      claimResponses: [],
      patientPaid: 0,
    });

    expect(totals).toEqual({
      chargedCents: 0,
      insurancePaidCents: 0,
      patientPaidCents: 0,
      balanceDueCents: 0,
      deductibleCents: 0,
    });
    expect(lines.map((line) => line.patientOwesCents)).toEqual([0, 0]);
  });

  it('still reports the payer figures for a claim the payer answered before it left insurance AR', () => {
    const { totals } = computeBillingStatementAmounts({
      claim: billingClaim({ arStage: AR_STAGE.insurancePayer }),
      claimResponses: [fullyAdjudicatedRemit()],
      patientPaid: 0,
    });

    // the remit is the authority once it exists, so the AR stage no longer gates anything
    expect(totals.insurancePaidCents).toBe(25_532);
    expect(totals.balanceDueCents).toBe(8800);
  });

  it('shares out an insurance payment the payer did not break down per procedure', () => {
    const remit = claimResponse({
      total: [
        {
          category: {
            coding: [
              {
                code: ADJUDICATION_CODES.PAID,
              },
            ],
          },
          amount: {
            value: 200,
            currency: 'USD',
          },
        },
      ],
    });

    const { lines, totals } = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [remit],
      patientPaid: 0,
    });

    expect(totals.insurancePaidCents).toBe(20_000);
    expect(sumOf(lines, 'insurancePaidCents')).toBe(20_000);
    expect(lines.map((line) => line.insurancePaidCents)).toEqual([4695, 15_305]);
  });

  it('reports the whole payment and turns an overpayment into a credit', () => {
    const { lines, totals } = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [fullyAdjudicatedRemit()],
      patientPaid: 120,
    });

    expect(totals.patientPaidCents).toBe(12_000);
    expect(totals.balanceDueCents).toBe(-3200);
    expect(lines).toEqual([
      {
        chargedCents: 7532,
        insurancePaidCents: 5532,
        patientPaidCents: 2000,
        patientOwesCents: 0,
      },
      {
        chargedCents: 26_800,
        insurancePaidCents: 20_000,
        patientPaidCents: 10_000,
        patientOwesCents: -3200,
      },
    ]);
  });

  it('keeps the totals when the claim carries no procedures', () => {
    const claim = billingClaim();
    delete claim.item;

    const { lines, totals } = computeBillingStatementAmounts({
      claim,
      claimResponses: [fullyAdjudicatedRemit()],
      patientPaid: 0,
    });

    expect(lines).toEqual([]);
    expect(totals.balanceDueCents).toBe(8800);
  });
});
