import { Claim, ClaimItem, ClaimResponse } from 'fhir/r4b';
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

const billingClaim = (items = [XRAY, OFFICE_VISIT]): Claim =>
  ({
    resourceType: 'Claim',
    id: 'c1',
    status: 'active',
    created: '2026-08-01',
    use: 'claim',
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
    insurance: [],
    item: items.map(claimItem),
    total: {
      value: items.reduce((sum, item) => sum + item.charge, 0),
      currency: 'USD',
    },
  }) as Claim;

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

  it('keeps every line reading charged less insurance paid less patient paid equals patient owes', () => {
    const { lines } = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [fullyAdjudicatedRemit()],
      patientPaid: 50,
    });

    for (const line of lines) {
      expect(line.chargedCents - line.insurancePaidCents - line.patientPaidCents).toBe(line.patientOwesCents);
    }
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
    // the extra 10 belongs to no procedure, so it lands on the last line
    expect(lines.map((line) => line.patientOwesCents)).toEqual([2000, 7800]);
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

  it('bills the whole visit to the patient until insurance has adjudicated', () => {
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

  it('stops at a zero balance when the patient has overpaid, leaving the credit off the visit', () => {
    const { lines, totals } = computeBillingStatementAmounts({
      claim: billingClaim(),
      claimResponses: [fullyAdjudicatedRemit()],
      patientPaid: 120,
    });

    expect(totals.patientPaidCents).toBe(8800);
    expect(totals.balanceDueCents).toBe(0);
    expect(lines.every((line) => line.patientOwesCents === 0)).toBe(true);
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
