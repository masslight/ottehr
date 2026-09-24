import { ClaimDetailResponse, ManualEraEntryClaim } from 'utils/lib/types/data/billing/billing.types';
import { describe, expect, it } from 'vitest';
import {
  addAdjustment,
  bucketIsLocked,
  bucketValue,
  claimFormFromClaimDetail,
  claimFormFromEntry,
  claimFormToInput,
  claimProblems,
  claimTotals,
  emptyClaimForm,
  emptyHeaderForm,
  emptyServiceLine,
  formatCentsForInput,
  headerFormFromEntry,
  headerFormToInput,
  headerProblems,
  lineImbalanceCents,
  parseMoneyToCents,
  reconcileRemit,
  removeAdjustment,
  ServiceLineForm,
  setBucketValue,
  setClaimServiceDate,
  setLineServiceDate,
  syncContractual,
  updateAdjustment,
} from '../../src/utils/manualEra';

const blankLine = (): ServiceLineForm => emptyServiceLine({ serviceDate: '2026-08-15', serviceLines: [] });

// what a biller does when typing into a field: set it, then let the derived CO-45 catch up
const typeBilled = (line: ServiceLineForm, value: string): ServiceLineForm =>
  syncContractual({ ...line, billed: value });
const typeAllowed = (line: ServiceLineForm, value: string): ServiceLineForm =>
  syncContractual({ ...line, allowed: value });

const codes = (line: ServiceLineForm): string[] =>
  line.adjustments.map((row) => `${row.groupCode}-${row.reasonCode} ${row.amount}`);

describe('money', () => {
  it.each([
    ['150', 15000],
    ['$1,234.5', 123450],
    ['.25', 25],
    ['-60', -6000],
    ['12.', 1200],
  ])('reads %j as %d cents', (text, cents) => {
    expect(parseMoneyToCents(text)).toBe(cents);
  });

  it.each(['', 'abc', '1.234', '--1'])('rejects %j', (text) => {
    expect(parseMoneyToCents(text)).toBeNull();
  });

  it('writes whole dollars without cents', () => {
    expect(formatCentsForInput(15000)).toBe('150');
    expect(formatCentsForInput(5025)).toBe('50.25');
    expect(formatCentsForInput(-6000)).toBe('-60');
  });
});

describe('CO-45 from billed and allowed', () => {
  it('appears once both are entered and follows them while untouched', () => {
    let line = typeBilled(blankLine(), '150');
    expect(line.adjustments).toEqual([]);
    line = typeAllowed(line, '100');
    expect(codes(line)).toEqual(['CO-45 50']);
    line = typeAllowed(line, '90');
    expect(codes(line)).toEqual(['CO-45 60']);
    line = typeBilled(line, '90');
    expect(line.adjustments).toEqual([]);
  });

  it('becomes the biller’s once edited: no updates, no second row', () => {
    let line = typeAllowed(typeBilled(blankLine(), '150'), '100');
    line = updateAdjustment(line, line.adjustments[0].key, { amount: '40' });
    line = typeAllowed(line, '80');
    expect(codes(line)).toEqual(['CO-45 40']);
  });

  it('stays gone once the biller removes it', () => {
    let line = typeAllowed(typeBilled(blankLine(), '150'), '100');
    line = removeAdjustment(line, line.adjustments[0].key);
    line = typeAllowed(line, '70');
    expect(line.adjustments).toEqual([]);
  });

  it('asks for the denial reason when nothing was allowed', () => {
    const line = typeAllowed(typeBilled(blankLine(), '150'), '0');
    expect(codes(line)).toEqual(['CO- 150']);
    expect(
      claimProblems(
        emptyClaimForm({ patientName: 'A', serviceLines: [{ ...line, procedureCode: '99212', paid: '0' }] })
      )
    ).toContain('Line 1: complete or remove each CARC (group, code and amount)');
  });

  it('adds nothing when the payer allowed more than was billed', () => {
    expect(typeAllowed(typeBilled(blankLine(), '100'), '120').adjustments).toEqual([]);
  });

  it('works for a reversal line', () => {
    expect(codes(typeAllowed(typeBilled(blankLine(), '-150'), '-100'))).toEqual(['CO-45 -50']);
  });
});

describe('deductible, co-insurance and co-pay', () => {
  it('are the PR-1, PR-2 and PR-3 rows', () => {
    let line = setBucketValue(blankLine(), 'copay', '25');
    line = setBucketValue(line, 'deductible', '25');
    expect(codes(line)).toEqual(['PR-3 25', 'PR-1 25']);
    expect(bucketValue(line, 'copay')).toBe('25');
    expect(bucketValue(line, 'coinsurance')).toBe('');

    line = setBucketValue(line, 'copay', '30');
    expect(codes(line)).toEqual(['PR-3 30', 'PR-1 25']);
    line = setBucketValue(line, 'copay', '');
    expect(codes(line)).toEqual(['PR-1 25']);
  });

  it('follow edits made to the rows themselves', () => {
    let line = setBucketValue(blankLine(), 'deductible', '25');
    line = updateAdjustment(line, line.adjustments[0].key, { reasonCode: '2' });
    expect(bucketValue(line, 'deductible')).toBe('');
    expect(bucketValue(line, 'coinsurance')).toBe('25');
    line = removeAdjustment(line, line.adjustments[0].key);
    expect(bucketValue(line, 'coinsurance')).toBe('');
  });

  it('lock when a line carries the same code twice', () => {
    let line = setBucketValue(blankLine(), 'deductible', '10');
    line = addAdjustment(line);
    line = updateAdjustment(line, line.adjustments[1].key, { groupCode: 'PR', reasonCode: '1', amount: '5' });
    expect(bucketIsLocked(line, 'deductible')).toBe(true);
    expect(bucketValue(line, 'deductible')).toBe('15');
    expect(setBucketValue(line, 'deductible', '99')).toBe(line);
  });
});

describe('service dates', () => {
  it('flow from the claim to the lines that still follow it', () => {
    let claim = emptyClaimForm({ patientName: 'Joe' });
    claim = { ...claim, serviceLines: [...claim.serviceLines, emptyServiceLine(claim)] };
    claim = setLineServiceDate(claim, claim.serviceLines[1].key, '2026-08-10');
    // the first date set on a line fills the empty claim date, and the other line follows it
    expect(claim.serviceDate).toBe('2026-08-10');
    expect(claim.serviceLines.map((line) => line.serviceDate)).toEqual(['2026-08-10', '2026-08-10']);

    claim = setClaimServiceDate(claim, '2026-08-15');
    expect(claim.serviceLines.map((line) => line.serviceDate)).toEqual(['2026-08-15', '2026-08-10']);
  });

  it('default a new line to the claim date', () => {
    expect(emptyServiceLine({ serviceDate: '2026-08-15', serviceLines: [] }).serviceDate).toBe('2026-08-15');
  });
});

describe('totals and reconciliation', () => {
  // the claim from the mockup: billed 150, allowed 100, paid 50, PR-1 25, PR-3 25
  const mockupClaim = (): ReturnType<typeof emptyClaimForm> => {
    let line = typeAllowed(typeBilled({ ...blankLine(), procedureCode: '99212', paid: '50' }, '150'), '100');
    line = setBucketValue(setBucketValue(line, 'copay', '25'), 'deductible', '25');
    return emptyClaimForm({ patientName: 'Joe Schmoe', serviceDate: '2026-08-15', serviceLines: [line] });
  };

  it('sums a claim and checks each line balances', () => {
    const claim = mockupClaim();
    expect(claimTotals(claim)).toEqual({ allowedCents: 10000, paidCents: 5000, patientRespCents: 5000 });
    expect(lineImbalanceCents(claim.serviceLines[0])).toBeNull();
    expect(lineImbalanceCents({ ...claim.serviceLines[0], paid: '45' })).toBe(500);
  });

  it('compares the check with what the claims paid', () => {
    expect(reconcileRemit('51000.45', [])).toEqual({
      checkAmountCents: 5100045,
      claimsPaidCents: 0,
      differenceCents: 5100045,
    });
    expect(reconcileRemit('50', [mockupClaim()]).differenceCents).toBe(0);
  });

  it('turns the form into the save input in cents', () => {
    const claim = mockupClaim();
    expect(claimProblems(claim)).toEqual([]);
    expect(claimFormToInput(claim)).toEqual({
      clientKey: claim.key,
      statusCode: '1',
      patientName: 'Joe Schmoe',
      serviceDate: '2026-08-15',
      memberId: undefined,
      patientAccountNumber: undefined,
      payerClaimControlNumber: undefined,
      serviceLines: [
        {
          serviceDate: '2026-08-15',
          procedureCode: '99212',
          billedCents: 15000,
          allowedCents: 10000,
          paidCents: 5000,
          adjustments: [
            { groupCode: 'CO', reasonCode: '45', amountCents: 5000 },
            { groupCode: 'PR', reasonCode: '3', amountCents: 2500 },
            { groupCode: 'PR', reasonCode: '1', amountCents: 2500 },
          ],
          remarkCodes: [],
        },
      ],
    });
  });
});

describe('loading and pre-filling', () => {
  const entry: ManualEraEntryClaim = {
    claimResponseId: 'cr-1',
    matchedClaimId: null,
    statusCode: '1',
    patientName: 'Joe Schmoe',
    serviceDate: '2026-08-15',
    serviceLines: [
      {
        itemSequence: 1,
        serviceDate: '2026-08-15',
        procedureCode: '99212',
        billedCents: 15000,
        allowedCents: 10000,
        paidCents: 5000,
        adjustments: [{ groupCode: 'CO', reasonCode: '45', amountCents: 5000 }],
        remarkCodes: ['N130'],
      },
    ],
  };

  it('re-links a saved CO-45 that still equals billed − allowed', () => {
    const claim = claimFormFromEntry(entry);
    const line = typeAllowed(claim.serviceLines[0], '80');
    expect(codes(line)).toEqual(['CO-45 70']);
    expect(claimFormToInput(claim)).toMatchObject({
      claimResponseId: 'cr-1',
      serviceLines: [{ itemSequence: 1, remarkCodes: ['N130'] }],
    });
  });

  it('leaves a saved line whose contractual adjustment differs to the biller', () => {
    const claim = claimFormFromEntry({
      ...entry,
      serviceLines: [
        { ...entry.serviceLines[0], adjustments: [{ groupCode: 'CO', reasonCode: '253', amountCents: 100 }] },
      ],
    });
    expect(codes(typeAllowed(claim.serviceLines[0], '80'))).toEqual(['CO-253 1']);
  });

  it('pre-fills a remit claim from an existing claim', () => {
    const detail = {
      id: 'claim-9',
      patientName: 'Schmoe, Joe',
      memberId: 'M1',
      subscriberId: '',
      pcn: 'PCN-9',
      serviceLines: [
        { sequence: 2, cptCode: '87880', charges: 50, serviceDate: '2026-08-15' },
        { sequence: 1, cptCode: '99213', charges: 125.5, serviceDate: '2026-08-15' },
      ],
    } as unknown as ClaimDetailResponse;
    const claim = claimFormFromClaimDetail(detail);
    expect(claim).toMatchObject({
      matchedClaimId: 'claim-9',
      patientName: 'Schmoe, Joe',
      memberId: 'M1',
      patientAccountNumber: 'PCN-9',
      serviceDate: '2026-08-15',
    });
    expect(claim.serviceLines.map((line) => [line.itemSequence, line.procedureCode, line.billed])).toEqual([
      [1, '99213', '125.50'],
      [2, '87880', '50'],
    ]);
    expect(claimFormToInput(claim)).toMatchObject({ matchedClaimId: 'claim-9' });
  });
});

describe('header', () => {
  it('requires the remit details the mockup marks', () => {
    expect(Object.keys(headerProblems(emptyHeaderForm())).sort()).toEqual(
      ['billingProviderRef', 'checkAmount', 'checkDate', 'checkNumber', 'depositDate', 'payerId', 'remitDate'].sort()
    );
    expect(headerProblems({ ...emptyHeaderForm(), checkAmount: '-5' }).checkAmount).toBe('Enter a dollar amount');
  });

  it('round-trips through the save input', () => {
    const header = {
      payerId: 'payer-uhc',
      billingProviderRef: 'Organization/org-1',
      checkNumber: '557801',
      checkAmountCents: 5100045,
      paymentMethod: 'ACH' as const,
      remitDate: '2026-09-13',
      checkDate: '2026-09-13',
      depositDate: '2026-09-13',
    };
    expect(headerFormToInput(headerFormFromEntry(header))).toEqual(header);
  });
});
