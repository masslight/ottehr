import { ClaimRemit, ClaimRemitAdjustment, EraRemitServiceLine } from 'utils/lib/types/data/billing/billing.types';
import { patientRespBuckets } from 'utils/lib/types/data/billing/carc';
import { describe, expect, it } from 'vitest';
import {
  adjustmentColumn,
  aggregateAdjustments,
  eraHref,
  groupRemitLines,
  groupUnmatchedRemitLines,
  insurancePaidByDesignation,
  ledgerAmounts,
  remitDesignation,
  RemitLineEntry,
} from '../../src/utils/claimRemits';

const adjustment = (
  groupCode: ClaimRemitAdjustment['groupCode'],
  reasonCode: string,
  amount: number
): ClaimRemitAdjustment => ({ groupCode, reasonCode, amount });

const serviceLine = (overrides: Partial<EraRemitServiceLine> = {}): EraRemitServiceLine => ({
  itemSequence: 1,
  claimItemSequence: 1,
  isClaimLevel: false,
  cptCode: '99213',
  modifiers: [],
  units: 1,
  serviceDate: '2026-07-01',
  billed: 150,
  allowed: 100,
  paid: 80,
  deductible: 0,
  coinsurance: 0,
  copay: 0,
  adjustments: [],
  ...overrides,
});

const remit = (overrides: Partial<ClaimRemit> = {}): ClaimRemit => ({
  claimResponseId: 'cr-1',
  date: '2026-07-15',
  payerName: 'Acme Health',
  status: 'complete',
  eraStatusCode: '1',
  allowed: 100,
  paid: 80,
  patientResp: 20,
  adjustments: [],
  paymentReconciliationId: 'pr-1',
  checkNumber: 'CHK-1',
  checkDate: '2026-07-16',
  serviceLines: [],
  ...overrides,
});

describe('adjustmentColumn', () => {
  it('puts every non-patient group in Ins adj', () => {
    expect(adjustmentColumn(adjustment('CO', '45', 1))).toBe('insuranceAdjustment');
    expect(adjustmentColumn(adjustment('OA', '23', 1))).toBe('insuranceAdjustment');
    expect(adjustmentColumn(adjustment('PI', '97', 1))).toBe('insuranceAdjustment');
    expect(adjustmentColumn(adjustment('CR', '45', 1))).toBe('insuranceAdjustment');
  });

  it('puts patient responsibility in its deductible, coinsurance, or copay bucket, else under Patient', () => {
    expect(adjustmentColumn(adjustment('PR', '1', 1))).toBe('deductible');
    expect(adjustmentColumn(adjustment('PR', '2', 1))).toBe('coinsurance');
    expect(adjustmentColumn(adjustment('PR', '3', 1))).toBe('copay');
    expect(adjustmentColumn(adjustment('PR', '96', 1))).toBe('patientResp');
    expect(adjustmentColumn(adjustment('PR', '', 1))).toBe('patientResp');
  });
});

describe('ledgerAmounts', () => {
  it('sums each column to the cent, keeping reversals negative', () => {
    const amounts = ledgerAmounts([
      adjustment('CO', '45', 0.1),
      adjustment('OA', '23', 0.2),
      adjustment('PR', '1', -15),
      adjustment('PR', '3', 25),
    ]);

    expect(amounts).toEqual({
      insuranceAdjustment: 0.3,
      deductible: -15,
      coinsurance: 0,
      copay: 25,
      patientResp: 10,
    });
  });

  it("totals the line's whole patient responsibility under Patient, matching the backend buckets", () => {
    const adjustments = [
      adjustment('PR', '1', 10),
      adjustment('PR', '2', 5.55),
      adjustment('PR', '3', 20),
      adjustment('PR', '96', 7),
      adjustment('CO', '45', 40),
    ];
    const amounts = ledgerAmounts(adjustments);
    const buckets = patientRespBuckets(adjustments);

    expect([amounts.deductible, amounts.coinsurance, amounts.copay]).toEqual([
      buckets.deductible,
      buckets.coinsurance,
      buckets.copay,
    ]);
    expect(amounts.patientResp).toBe(42.55);
    expect(amounts.patientResp).toBeCloseTo(buckets.deductible + buckets.coinsurance + buckets.copay + buckets.other);
  });
});

describe('groupRemitLines', () => {
  it('files each remit line under its claim line, oldest remit first, with keys unique per line', () => {
    // claim.remits arrives newest first
    const correction = remit({
      claimResponseId: 'cr-correction',
      serviceLines: [serviceLine({ claimItemSequence: 1 }), serviceLine({ claimItemSequence: 2, cptCode: '81002' })],
    });
    const original = remit({
      claimResponseId: 'cr-original',
      serviceLines: [serviceLine({ claimItemSequence: 1 })],
    });

    const { byClaimLine, other } = groupRemitLines([correction, original], [1, 2]);

    expect(byClaimLine.get(1)?.map((entry) => entry.remit.claimResponseId)).toEqual(['cr-original', 'cr-correction']);
    expect(byClaimLine.get(2)?.map((entry) => entry.key)).toEqual(['cr-correction:1']);
    expect(byClaimLine.get(1)?.map((entry) => entry.key)).toEqual(['cr-original:0', 'cr-correction:0']);
    expect(other).toEqual([]);
  });

  it('sets aside claim-level adjustments and lines it could not pin to a claim line', () => {
    const claimLevel = serviceLine({ isClaimLevel: true, claimItemSequence: null, cptCode: '' });
    const unassigned = serviceLine({ claimItemSequence: null, cptCode: '99214' });
    const offClaim = serviceLine({ claimItemSequence: 9 });

    const { byClaimLine, other } = groupRemitLines([remit({ serviceLines: [unassigned, claimLevel, offClaim] })], [1]);

    expect(byClaimLine.size).toBe(0);
    expect(other.map((entry) => entry.line)).toEqual([unassigned, claimLevel, offClaim]);
  });

  it('keeps keys unique when remits carry no id', () => {
    const { byClaimLine } = groupRemitLines(
      [
        remit({ claimResponseId: '', serviceLines: [serviceLine()] }),
        remit({ claimResponseId: '', serviceLines: [serviceLine()] }),
      ],
      [1]
    );

    const keys = byClaimLine.get(1)?.map((entry) => entry.key) ?? [];
    expect(new Set(keys).size).toBe(2);
  });
});

describe('groupUnmatchedRemitLines', () => {
  const entry = (claimResponseId: string, line: EraRemitServiceLine, lineIndex = 0): RemitLineEntry => ({
    key: `${claimResponseId}:${lineIndex}`,
    remit: remit({ claimResponseId }),
    line,
  });

  it('makes one line per adjudicated code across remits, with the claim-level adjustments last', () => {
    const claimLevel = entry(
      'cr-1',
      serviceLine({
        isClaimLevel: true,
        claimItemSequence: null,
        cptCode: '',
        units: null,
        billed: null,
        serviceDate: '',
      }),
      2
    );
    const original = entry('cr-1', serviceLine({ claimItemSequence: null, cptCode: '99214', units: 1, billed: 150 }));
    const otherCode = entry('cr-1', serviceLine({ claimItemSequence: null, cptCode: '81002', billed: 20 }), 1);
    const reversal = entry(
      'cr-2',
      serviceLine({ claimItemSequence: null, cptCode: '99214', units: null, billed: -150 })
    );

    const lines = groupUnmatchedRemitLines([claimLevel, original, otherCode, reversal]);

    expect(lines.map((line) => line.key)).toEqual(['code:99214', 'code:81002', 'claim-level']);
    expect(lines[0]).toMatchObject({
      isClaimLevel: false,
      cptCode: '99214',
      serviceDate: '2026-07-01',
      units: 1,
      billed: 150,
    });
    expect(lines[0].entries).toEqual([original, reversal]);
    expect(lines[2]).toMatchObject({ isClaimLevel: true, cptCode: '', serviceDate: '', units: null, billed: null });
    expect(lines[2].entries).toEqual([claimLevel]);
  });

  it('shows the charge as billed even when a reversal of it comes first', () => {
    const [line] = groupUnmatchedRemitLines([
      entry('cr-1', serviceLine({ claimItemSequence: null, cptCode: '99214', billed: -150 })),
      entry('cr-2', serviceLine({ claimItemSequence: null, cptCode: '99214', billed: 150 })),
    ]);

    expect(line.billed).toBe(150);
  });
});

describe('aggregateAdjustments', () => {
  it('sums adjustments per group and reason code, in first-seen order', () => {
    expect(
      aggregateAdjustments([
        adjustment('CO', '45', 40.21),
        adjustment('PR', '3', 25),
        adjustment('CO', '45', 4),
        adjustment('PR', '1', 15),
      ])
    ).toEqual([adjustment('CO', '45', 44.21), adjustment('PR', '3', 25), adjustment('PR', '1', 15)]);
  });
});

describe('remitDesignation', () => {
  it("takes the payer rank from the remit's own CLP02 status", () => {
    const remits = [
      remit({ eraStatusCode: '1' }),
      remit({ eraStatusCode: '19' }),
      remit({ eraStatusCode: '2' }),
      remit({ eraStatusCode: '20' }),
      remit({ eraStatusCode: '3' }),
      remit({ eraStatusCode: '21' }),
    ];

    expect(remits.map((candidate) => remitDesignation(candidate, remits))).toEqual([
      'Primary',
      'Primary',
      'Secondary',
      'Secondary',
      'Tertiary',
      'Tertiary',
    ]);
  });

  it('ranks a reversal like the correction on its ERA, even under another payer name', () => {
    const reversal = remit({ claimResponseId: 'cr-reversal', eraStatusCode: '22', payerName: 'Acme' });
    const correction = remit({ claimResponseId: 'cr-correction', eraStatusCode: '2', payerName: 'Acme Health' });
    const primary = remit({
      claimResponseId: 'cr-primary',
      eraStatusCode: '1',
      payerName: 'Acme',
      paymentReconciliationId: 'pr-other',
    });

    expect(remitDesignation(reversal, [correction, reversal, primary])).toBe('Secondary');
  });

  it("ranks a denial like the same payer's other remit when no ERA peer has a rank", () => {
    const denial = remit({ claimResponseId: 'cr-denied', eraStatusCode: '4', paymentReconciliationId: 'pr-2' });
    const paid = remit({ claimResponseId: 'cr-paid', eraStatusCode: '1', paymentReconciliationId: 'pr-1' });

    expect(remitDesignation(denial, [paid, denial])).toBe('Primary');
  });

  it('falls back to the ERA status label, then Other', () => {
    const denial = remit({ eraStatusCode: '4' });
    const unknown = remit({ eraStatusCode: '' });

    expect(remitDesignation(denial, [denial])).toBe('Denied');
    expect(remitDesignation(unknown, [unknown])).toBe('Other');
  });
});

describe('insurancePaidByDesignation', () => {
  it('nets a reversal against its rank and orders ranks first', () => {
    const remits = [
      remit({ claimResponseId: 'cr-secondary', eraStatusCode: '2', paid: 20, paymentReconciliationId: 'pr-2' }),
      remit({ claimResponseId: 'cr-correction', eraStatusCode: '1', paid: 70 }),
      remit({ claimResponseId: 'cr-reversal', eraStatusCode: '22', paid: -60 }),
      remit({ claimResponseId: 'cr-original', eraStatusCode: '1', paid: 60 }),
    ];

    const split = insurancePaidByDesignation(remits);

    expect(split).toEqual([
      { designation: 'Primary', amount: 70 },
      { designation: 'Secondary', amount: 20 },
    ]);
    expect(split.reduce((sum, entry) => sum + entry.amount, 0)).toBe(90);
  });

  it('lists unranked money after the ranks', () => {
    expect(
      insurancePaidByDesignation([
        remit({ claimResponseId: 'cr-unknown', eraStatusCode: '', payerName: 'Other Payer', paid: 5 }),
        remit({ claimResponseId: 'cr-primary', eraStatusCode: '1', paid: 0.1, paymentReconciliationId: 'pr-2' }),
        remit({ claimResponseId: 'cr-primary-2', eraStatusCode: '1', paid: 0.2, paymentReconciliationId: 'pr-3' }),
      ])
    ).toEqual([
      { designation: 'Primary', amount: 0.3 },
      { designation: 'Other', amount: 5 },
    ]);
  });
});

describe('eraHref', () => {
  it('links to the ERA details page', () => {
    expect(eraHref('pr-1')).toBe('/eras/pr-1');
  });
});
