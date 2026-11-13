import { ClaimResponse, ClaimResponseItemAdjudication } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  ADJUDICATION_CODES,
  OYSTEHR_ADJUDICATION_SYSTEM,
  summarizeClaimPayments,
  X12_ADJUSTMENT_GROUP_SYSTEM,
} from '../../../src/billing/claim-amounts';
import {
  applyRemit,
  claimBalanceSteps,
  initialClaimBalances,
  readRemitAmounts,
  summarizeClaimBalances,
} from '../../../src/billing/claim-balances';

const amount = (code: string, value: number): ClaimResponseItemAdjudication => ({
  category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code }] },
  amount: { value, currency: 'USD' },
});

const cas = (group: string, value: number, reason = ''): ClaimResponseItemAdjudication => ({
  category: { coding: [{ system: X12_ADJUSTMENT_GROUP_SYSTEM, code: group }] },
  reason: { coding: [{ code: reason }] },
  amount: { value, currency: 'USD' },
});

const remit = (
  id: string,
  created: string,
  parts: { charge?: number; allowed?: number; paid: number; adjustments?: ClaimResponseItemAdjudication[] }
): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  id,
  status: 'active',
  type: { coding: [{ code: 'professional' }] },
  use: 'claim',
  patient: { reference: 'Patient/p1' },
  created,
  insurer: { reference: 'https://rcm-api.zapehr.com/v1/payer/12345' },
  outcome: 'complete',
  request: { reference: 'Claim/c1' },
  total: [
    { category: { coding: [{ code: ADJUDICATION_CODES.PAID }] }, amount: { value: parts.paid, currency: 'USD' } },
  ],
  item: [
    {
      itemSequence: 1,
      adjudication: [
        ...(parts.charge !== undefined ? [amount(ADJUDICATION_CODES.CHARGE, parts.charge)] : []),
        ...(parts.allowed !== undefined ? [amount(ADJUDICATION_CODES.ALLOWED, parts.allowed)] : []),
        amount(ADJUDICATION_CODES.PAID, parts.paid),
        ...(parts.adjustments ?? []),
      ],
    },
  ],
});

// billed 100, allowed 80, paid 60, CO-45 20, PR 20
const primary = remit('primary', '2026-01-01', {
  charge: 100,
  allowed: 80,
  paid: 60,
  adjustments: [cas('CO', 20, '45'), cas('PR', 20, '1')],
});
// billed 120, allowed 100, paid 98, CO-45 20, CO-253 2 (sequestration)
const sequestration = (id: string, created: string, sign: 1 | -1 = 1): ClaimResponse =>
  remit(id, created, {
    charge: sign * 120,
    allowed: sign * 100,
    paid: sign * 98,
    adjustments: [cas('CO', sign * 20, '45'), cas('CO', sign * 2, '253')],
  });

const scenarios: { name: string; billed: number; remits: ClaimResponse[]; patientPaid?: number }[] = [
  { name: 'no remits', billed: 150, remits: [] },
  { name: 'single remit with PR', billed: 100, remits: [primary] },
  {
    name: 'secondary with PR',
    billed: 100,
    remits: [primary, remit('secondary', '2026-02-01', { paid: 15, adjustments: [cas('PR', 5, '2')] })],
    patientPaid: 3,
  },
  { name: 'bare remit without allowed', billed: 100, remits: [remit('bare', '2026-01-01', { paid: 60 })] },
  {
    name: 'secondary writes off what it did not pay',
    billed: 100,
    remits: [
      primary,
      remit('secondary', '2026-02-01', { paid: 10, adjustments: [cas('OA', 80, '23'), cas('CO', 10, '45')] }),
    ],
  },
  { name: 'sequestration', billed: 120, remits: [sequestration('seq', '2026-01-01')] },
  {
    name: 'manual remit with allowed and only sequestration',
    billed: 120,
    remits: [
      remit('manual', '2026-01-01', { charge: 120, allowed: 100, paid: 98, adjustments: [cas('CO', 2, '253')] }),
    ],
  },
  {
    name: 'secondary repeats allowed',
    billed: 120,
    remits: [
      sequestration('seq', '2026-01-01'),
      remit('secondary', '2026-02-01', { charge: 120, allowed: 100, paid: 0, adjustments: [cas('OA', 120, '23')] }),
    ],
  },
  {
    name: 'reversal and correction',
    billed: 120,
    remits: [
      sequestration('original', '2026-01-01'),
      sequestration('reversal', '2026-02-01', -1),
      sequestration('correction', '2026-03-01'),
    ],
  },
  {
    name: 'only a later manual remit reports allowed',
    billed: 100,
    remits: [
      remit('primary', '2026-01-01', { paid: 60, adjustments: [cas('CO', 20, '45'), cas('PR', 20, '1')] }),
      remit('manual', '2026-02-01', { allowed: 80, paid: 10 }),
    ],
  },
  {
    name: 'billed basis with write-offs across payers',
    billed: 100,
    remits: [
      remit('primary', '2026-01-01', { paid: 60, adjustments: [cas('CO', 25, '45')] }),
      remit('secondary', '2026-02-01', { paid: 5, adjustments: [cas('OA', 85, '23')] }),
    ],
  },
];

describe('summarizeClaimBalances', () => {
  it.each(scenarios)('matches summarizeClaimPayments: $name', ({ billed, remits, patientPaid }) => {
    expect(summarizeClaimBalances(remits, billed, patientPaid)).toEqual(
      summarizeClaimPayments(remits, billed, patientPaid)
    );
  });
});

describe('readRemitAmounts', () => {
  it('splits write-offs into the reduction to allowed and what lies beyond it', () => {
    expect(readRemitAmounts(sequestration('seq', '2026-01-01'), 120)).toEqual({
      paid: 98,
      allowed: 100,
      patientResp: undefined,
      writeOffs: 22,
      reductionToAllowed: 20,
      writeOffsBeyondAllowed: 2,
    });
  });

  it('negates the split for a reversal', () => {
    expect(readRemitAmounts(sequestration('reversal', '2026-02-01', -1), 120)).toMatchObject({
      reductionToAllowed: -20,
      writeOffsBeyondAllowed: -2,
    });
  });
});

describe('applyRemit', () => {
  it('folds a remit into the running balances', () => {
    const balances = applyRemit(initialClaimBalances(120), readRemitAmounts(sequestration('seq', '2026-01-01'), 120));
    expect(balances).toEqual({
      billed: 120,
      allowed: 100,
      insurancePaid: 98,
      reportedPatientResp: undefined,
      writeOffsBeyondAllowed: 2,
      reductionCarried: 20,
      writeOffsWithoutAllowed: 0,
      patientResp: 0,
    });
  });
});

describe('claimBalanceSteps', () => {
  it('records each remit and the balances it left, oldest first', () => {
    const steps = claimBalanceSteps(
      [
        remit('manual', '2026-02-01', { allowed: 80, paid: 10 }),
        remit('primary', '2026-01-01', { paid: 60, adjustments: [cas('CO', 20, '45'), cas('PR', 20, '1')] }),
      ],
      100
    );
    expect(steps.map((step) => [step.claimResponseId, step.balances.patientResp])).toEqual([
      ['primary', 20],
      ['manual', 10],
    ]);
    expect(steps[1].balances).toMatchObject({ allowed: 80, insurancePaid: 70, writeOffsWithoutAllowed: 20 });
  });
});
