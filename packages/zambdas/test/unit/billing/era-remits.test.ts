import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, ClaimResponseItemAdjudication, Organization, PaymentReconciliation } from 'fhir/r4b';
import {
  FHIR_IDENTIFIER_CODE_TAX_EMPLOYER,
  FHIR_IDENTIFIER_NPI,
  FHIR_IDENTIFIER_SYSTEM,
  X12_ADJUSTMENT_GROUP_CODE,
} from 'utils';
import { describe, expect, it, vi } from 'vitest';
import {
  ADJUDICATION_CODES,
  OYSTEHR_ADJUDICATION_SYSTEM,
  X12_ADJUSTMENT_GROUP_SYSTEM,
} from '../../../src/billing/claim-amounts';
import {
  buildEraClaimRemit,
  buildEraRemitServiceLines,
  eraPatientAccountNumber,
  resolveEraPayee,
} from '../../../src/billing/era-remits';
import { CLAIM_PCN_IDENTIFIER_SYSTEM, ERA_STATUS_CODE_EXTENSION } from '../../../src/billing/shared';

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

const claimResponse = (overrides: Partial<ClaimResponse> = {}): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  id: 'cr-1',
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
  created: '2026-07-15',
  insurer: {
    display: 'Test Payer',
  },
  outcome: 'complete',
  request: {
    reference: 'Claim/c1',
  },
  ...overrides,
});

const submittedClaim = (overrides: Partial<Claim> = {}): Claim =>
  ({
    resourceType: 'Claim',
    id: 'c1',
    status: 'active',
    created: '2026-07-10',
    use: 'claim',
    type: { coding: [] },
    priority: { coding: [] },
    patient: { reference: 'Patient/p1' },
    provider: { reference: 'Organization/prov-1' },
    insurance: [],
    item: [
      {
        sequence: 1,
        productOrService: { coding: [{ code: '99213' }] },
        modifier: [{ coding: [{ code: '25' }] }],
        quantity: { value: 1 },
        servicedPeriod: { start: '2026-07-09', end: '2026-07-09' },
        net: { value: 100, currency: 'USD' },
      },
      {
        sequence: 2,
        productOrService: { coding: [{ code: '87880' }] },
        quantity: { value: 2 },
        servicedDate: '2026-07-09',
        net: { value: 50, currency: 'USD' },
      },
    ],
    ...overrides,
  }) as Claim;

describe('buildEraRemitServiceLines', () => {
  it('joins Claim.MD-shape items back to the submitted claim lines', () => {
    const cr = claimResponse({
      item: [
        {
          itemSequence: 1,
          adjudication: [
            adjudication(ADJUDICATION_CODES.CHARGE, 100),
            adjudication(ADJUDICATION_CODES.PAID, 60),
            adjudication(ADJUDICATION_CODES.ALLOWED, 80),
            casAdjustment('PR', 20, '1'),
            casAdjustment('CO', 20, '45'),
          ],
        },
      ],
    });

    const lines = buildEraRemitServiceLines(cr, submittedClaim());

    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({
      itemSequence: 1,
      isClaimLevel: false,
      cptCode: '99213',
      modifiers: ['25'],
      units: 1,
      serviceDate: '2026-07-09',
      billed: 100,
      allowed: 80,
      paid: 60,
      deductible: 20,
      coinsurance: 0,
      copay: 0,
      adjustments: [
        { groupCode: 'PR', reasonCode: '1', amount: 20 },
        { groupCode: 'CO', reasonCode: '45', amount: 20 },
      ],
    });
  });

  it('maps the process-era shape: B6 allowed and the claim-level addItem CAS bucket', () => {
    const cr = claimResponse({
      item: [
        {
          itemSequence: 2,
          adjudication: [
            adjudication(ADJUDICATION_CODES.CHARGE, 50),
            adjudication(ADJUDICATION_CODES.PAID, 30),
            adjudication(ADJUDICATION_CODES.ALLOWED_X12, 40),
            casAdjustment('PR', 10, '2'),
          ],
        },
      ],
      addItem: [
        {
          productOrService: { coding: [{ code: 'unknown' }] },
          adjudication: [casAdjustment('PR', 5, '3')],
        },
      ],
    });

    const lines = buildEraRemitServiceLines(cr, submittedClaim());

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      cptCode: '87880',
      units: 2,
      serviceDate: '2026-07-09',
      billed: 50,
      allowed: 40,
      paid: 30,
      coinsurance: 10,
    });
    expect(lines[1]).toMatchObject({
      itemSequence: null,
      isClaimLevel: true,
      cptCode: '',
      copay: 5,
      paid: 0,
      billed: null,
      allowed: null,
    });
  });

  it('degrades to an amounts-only line when the item sequence has no submitted counterpart', () => {
    const cr = claimResponse({
      item: [
        {
          itemSequence: 7,
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 60)],
        },
      ],
    });

    const lines = buildEraRemitServiceLines(cr, submittedClaim());

    expect(lines[0]).toMatchObject({
      itemSequence: 7,
      cptCode: '',
      modifiers: [],
      units: null,
      serviceDate: '',
      billed: null,
      paid: 60,
    });
  });

  it('degrades to amounts-only lines when there is no claim at all', () => {
    const cr = claimResponse({
      item: [
        {
          itemSequence: 1,
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 60), casAdjustment('CO', 40, '45')],
        },
      ],
    });

    const lines = buildEraRemitServiceLines(cr, undefined);

    expect(lines[0]).toMatchObject({ cptCode: '', serviceDate: '', paid: 60 });
    expect(lines[0].adjustments).toEqual([{ groupCode: 'CO', reasonCode: '45', amount: 40 }]);
  });

  it('falls back to the submitted line net amount when the payer reports no charge', () => {
    const cr = claimResponse({
      item: [
        {
          itemSequence: 1,
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 60)],
        },
      ],
    });

    const lines = buildEraRemitServiceLines(cr, submittedClaim());

    expect(lines[0].billed).toBe(100);
  });

  it('falls back to the contained claim when the matched claim lines do not correspond', () => {
    // a manual match attached this remit to a claim whose only line is sequence 9
    const manuallyMatched = submittedClaim({
      item: [
        {
          sequence: 9,
          productOrService: { coding: [{ code: '11111' }] },
          net: { value: 75, currency: 'USD' },
        },
      ],
    });
    const cr = claimResponse({
      contained: [submittedClaim({ id: 'contained-claim' })],
      item: [
        {
          itemSequence: 1,
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 60)],
        },
      ],
    });

    const lines = buildEraRemitServiceLines(cr, manuallyMatched);

    expect(lines[0].cptCode).toBe('99213');
  });
});

describe('eraPatientAccountNumber', () => {
  it('uses the PCN identifier on matched claims when present', () => {
    const claim = submittedClaim({
      identifier: [{ system: CLAIM_PCN_IDENTIFIER_SYSTEM, value: 'PCN-42' }],
    });
    expect(eraPatientAccountNumber(claim, true)).toBe('PCN-42');
  });

  it('falls back to the dash-stripped claim id on matched claims', () => {
    const claim = submittedClaim({ id: 'aaaa-bbbb' });
    expect(eraPatientAccountNumber(claim, true)).toBe('aaaabbbb');
  });

  it('reads only identifiers on unmatched claims, never the synthetic id', () => {
    const withPcn = submittedClaim({
      id: 'unmatched-cr-1',
      identifier: [{ system: CLAIM_PCN_IDENTIFIER_SYSTEM, value: 'ECHOED-01' }],
    });
    expect(eraPatientAccountNumber(withPcn, false)).toBe('ECHOED-01');

    const withOther = submittedClaim({
      id: 'unmatched-cr-1',
      identifier: [{ value: 'ACC-7' }],
    });
    expect(eraPatientAccountNumber(withOther, false)).toBe('ACC-7');

    const withNone = submittedClaim({ id: 'unmatched-cr-1', identifier: undefined });
    expect(eraPatientAccountNumber(withNone, false)).toBe('');

    expect(eraPatientAccountNumber(undefined, false)).toBe('');
  });
});

describe('buildEraClaimRemit', () => {
  it('carries CLP-level fields: status code, ICN, disposition, notes', () => {
    const cr = claimResponse({
      identifier: [{ value: 'ICN-123' }],
      disposition: 'Processed as primary',
      extension: [{ url: ERA_STATUS_CODE_EXTENSION, valueString: '1' }],
      processNote: [{ text: 'N130: consult plan benefit documents' }],
      item: [
        {
          itemSequence: 1,
          adjudication: [
            adjudication(ADJUDICATION_CODES.CHARGE, 100),
            adjudication(ADJUDICATION_CODES.PAID, 60),
            adjudication(ADJUDICATION_CODES.ALLOWED, 80),
            casAdjustment('PR', 20, '2'),
          ],
        },
      ],
    });

    const remit = buildEraClaimRemit(cr, submittedClaim());

    expect(remit).toMatchObject({
      claimResponseId: 'cr-1',
      created: '2026-07-15',
      outcome: 'complete',
      disposition: 'Processed as primary',
      eraStatusCode: '1',
      payerClaimControlNumber: 'ICN-123',
      allowed: 80,
      paid: 60,
      patientResp: 20,
      notes: ['N130: consult plan benefit documents'],
    });
    expect(remit.serviceLines).toHaveLength(1);
  });

  it('aggregates PR adjustments per reason code across items and addItem', () => {
    const cr = claimResponse({
      item: [
        {
          itemSequence: 1,
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 30), casAdjustment('PR', 10.005, '2')],
        },
        {
          itemSequence: 2,
          adjudication: [
            adjudication(ADJUDICATION_CODES.PAID, 30),
            casAdjustment('PR', 5, '2'),
            casAdjustment('CO', 40, '45'),
          ],
        },
      ],
      addItem: [
        {
          productOrService: { coding: [{ code: 'unknown' }] },
          adjudication: [casAdjustment('PR', 25, '1')],
        },
      ],
    });

    const remit = buildEraClaimRemit(cr, submittedClaim());

    expect(remit.patientRespAdjustments).toEqual([
      { groupCode: X12_ADJUSTMENT_GROUP_CODE.patientResponsibility, reasonCode: '2', amount: 15.01 },
      { groupCode: X12_ADJUSTMENT_GROUP_CODE.patientResponsibility, reasonCode: '1', amount: 25 },
    ]);
  });

  it('passes reversal remits through with negative amounts and CLP02 22', () => {
    const cr = claimResponse({
      extension: [{ url: ERA_STATUS_CODE_EXTENSION, valueString: '22' }],
      item: [
        {
          itemSequence: 1,
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, -60), casAdjustment('PR', -20, '1')],
        },
      ],
    });

    const remit = buildEraClaimRemit(cr, submittedClaim());

    expect(remit.eraStatusCode).toBe('22');
    expect(remit.paid).toBe(-60);
    expect(remit.serviceLines[0].deductible).toBe(-20);
  });
});

describe('resolveEraPayee', () => {
  const oystehrWith = (get: ReturnType<typeof vi.fn>): Oystehr => ({ fhir: { get } }) as unknown as Oystehr;

  const payeeOrg: Organization = {
    resourceType: 'Organization',
    id: 'payee-1',
    name: 'Ottehr Medical Group',
    identifier: [
      { system: FHIR_IDENTIFIER_NPI, value: '1234567890' },
      {
        type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: FHIR_IDENTIFIER_CODE_TAX_EMPLOYER }] },
        value: '123456789',
      },
    ],
  };

  const pr = (overrides: Partial<PaymentReconciliation> = {}): PaymentReconciliation =>
    ({
      resourceType: 'PaymentReconciliation',
      id: 'era-1',
      status: 'active',
      created: '2026-07-20',
      paymentAmount: { value: 60, currency: 'USD' },
      ...overrides,
    }) as PaymentReconciliation;

  it('returns null when the ERA carries no payee', async () => {
    const get = vi.fn();
    expect(await resolveEraPayee(oystehrWith(get), pr())).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('resolves a contained payee organization', async () => {
    const get = vi.fn();
    const payee = await resolveEraPayee(
      oystehrWith(get),
      pr({
        contained: [payeeOrg],
        requestor: { reference: '#payee-1' },
      })
    );
    expect(payee).toEqual({ name: 'Ottehr Medical Group', npi: '1234567890', taxId: '123456789' });
    expect(get).not.toHaveBeenCalled();
  });

  it('fetches a referenced payee organization', async () => {
    const get = vi.fn().mockResolvedValue(payeeOrg);
    const payee = await resolveEraPayee(oystehrWith(get), pr({ requestor: { reference: 'Organization/payee-1' } }));
    expect(get).toHaveBeenCalledWith({ resourceType: 'Organization', id: 'payee-1' });
    expect(payee).toEqual({ name: 'Ottehr Medical Group', npi: '1234567890', taxId: '123456789' });
  });

  it('falls back to the reference display when the fetch fails', async () => {
    const get = vi.fn().mockRejectedValue(new Error('nope'));
    const payee = await resolveEraPayee(
      oystehrWith(get),
      pr({ requestor: { reference: 'Organization/payee-1', display: 'Ottehr Medical Group' } })
    );
    expect(payee).toEqual({ name: 'Ottehr Medical Group', npi: '', taxId: '' });
  });

  it('reads detail[].payee after requestor', async () => {
    const get = vi.fn();
    const payee = await resolveEraPayee(
      oystehrWith(get),
      pr({ detail: [{ type: { coding: [] }, payee: { display: 'From Detail' } }] })
    );
    expect(payee).toEqual({ name: 'From Detail', npi: '', taxId: '' });
  });
});
