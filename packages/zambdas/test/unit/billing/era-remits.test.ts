import { Claim, ClaimResponse, Coverage, Organization, Patient } from 'fhir/r4b';
import {
  FHIR_IDENTIFIER_CODE_TAX_EMPLOYER,
  FHIR_IDENTIFIER_NPI,
  FHIR_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { ADJUDICATION_CODES } from '../../../src/billing/claim-amounts';
import {
  buildEraClaimRemit,
  buildEraRemitServiceLines,
  eraContainedMemberId,
  eraPatientAccountNumber,
  resolveEraPayee,
} from '../../../src/billing/era-remits';
import {
  CLAIM_PCN_IDENTIFIER_SYSTEM,
  ERA_ICN_EXTENSION,
  ERA_ITEM_PROCEDURE_CODE_EXTENSION,
  ERA_PCN_EXTENSION,
  ERA_STATUS_CODE_EXTENSION,
} from '../../../src/billing/shared';
import { adjudication, casAdjustment, claimResponse, eraItem } from './era-fixtures';

const eraExtensions = (parts: { statusCode?: string; pcn?: string; icn?: string }): ClaimResponse['extension'] => [
  ...(parts.statusCode ? [{ url: ERA_STATUS_CODE_EXTENSION, valueString: parts.statusCode }] : []),
  ...(parts.pcn ? [{ url: ERA_PCN_EXTENSION, valueString: parts.pcn }] : []),
  ...(parts.icn ? [{ url: ERA_ICN_EXTENSION, valueString: parts.icn }] : []),
];

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

// The unmatched shape the process-era converter produces: contained Claim with no items, plus the
// billing provider it was submitted under.
const containedClaim = (overrides: Partial<Claim> = {}): Claim =>
  ({
    resourceType: 'Claim',
    id: 'request',
    status: 'active',
    use: 'claim',
    created: '2026-01-05',
    type: { coding: [] },
    priority: { coding: [] },
    patient: { reference: '#patient' },
    provider: { reference: '#billing-provider' },
    insurance: [],
    ...overrides,
  }) as Claim;

describe('buildEraRemitServiceLines', () => {
  it('reads procedure code and units from the item extensions the converter writes', () => {
    const cr = claimResponse({
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '73100',
          units: 1,
          adjudication: [
            adjudication(ADJUDICATION_CODES.CHARGE, 104),
            adjudication(ADJUDICATION_CODES.PAID, 55.32),
            adjudication(ADJUDICATION_CODES.ALLOWED, 55.32),
            casAdjustment('CO', 48.68, '45'),
          ],
        }),
      ],
      contained: [containedClaim()],
    });

    const lines = buildEraRemitServiceLines(cr, undefined);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({
      itemSequence: 1,
      claimItemSequence: null,
      isClaimLevel: false,
      cptCode: '73100',
      modifiers: [],
      units: 1,
      // no DTM 472 in the remit, so the contained claim's date stands in
      serviceDate: '2026-01-05',
      billed: 104,
      allowed: 55.32,
      paid: 55.32,
      deductible: 0,
      coinsurance: 0,
      copay: 0,
      adjustments: [{ groupCode: 'CO', reasonCode: '45', amount: 48.68 }],
    });
  });

  it('treats converter-stamped zero units as not reported', () => {
    const cr = claimResponse({
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '99213',
          units: 0,
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 42.98)],
        }),
      ],
    });

    expect(buildEraRemitServiceLines(cr, undefined)[0].units).toBeNull();
  });

  it('enriches a matched line with the submitted modifiers, units and date by procedure code', () => {
    const cr = claimResponse({
      item: [
        eraItem({
          sequence: 2,
          procedureCode: '99213',
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 60), adjudication(ADJUDICATION_CODES.ALLOWED, 80)],
        }),
      ],
    });

    // the remit calls it line 2, but our line 2 is a different code — the sequence join isn't
    // corroborated, so the greedy code match wins
    const lines = buildEraRemitServiceLines(cr, submittedClaim());

    expect(lines[0]).toMatchObject({
      cptCode: '99213',
      modifiers: ['25'],
      units: 1,
      serviceDate: '2026-07-09',
      billed: 100,
    });
  });

  it('trusts the sequence join for repeated codes when the REF*6R round-trip preserved our line numbers', () => {
    const claim = submittedClaim({
      item: [
        {
          sequence: 1,
          productOrService: { coding: [{ code: '99213' }] },
          modifier: [{ coding: [{ code: '25' }] }],
          servicedPeriod: { start: '2026-07-09' },
          net: { value: 100, currency: 'USD' },
        },
        {
          sequence: 2,
          productOrService: { coding: [{ code: '99213' }] },
          quantity: { value: 2 },
          servicedDate: '2026-07-10',
          net: { value: 50, currency: 'USD' },
        },
      ],
    });
    const cr = claimResponse({
      item: [
        eraItem({ sequence: 1, procedureCode: '99213', adjudication: [adjudication(ADJUDICATION_CODES.PAID, 60)] }),
        eraItem({ sequence: 2, procedureCode: '99213', adjudication: [adjudication(ADJUDICATION_CODES.PAID, 30)] }),
      ],
    });

    const lines = buildEraRemitServiceLines(cr, claim);

    expect(lines[0]).toMatchObject({
      claimItemSequence: 1,
      modifiers: ['25'],
      serviceDate: '2026-07-09',
      billed: 100,
    });
    expect(lines[1]).toMatchObject({
      claimItemSequence: 2,
      modifiers: [],
      units: 2,
      serviceDate: '2026-07-10',
      billed: 50,
    });
  });

  it('assigns crossed positional sequences by code, one line each', () => {
    // the payer numbered its SVC loops in its own order: line 1 is our 87880, line 2 our 99213
    const cr = claimResponse({
      item: [
        eraItem({ sequence: 1, procedureCode: '87880', adjudication: [adjudication(ADJUDICATION_CODES.PAID, 25)] }),
        eraItem({ sequence: 2, procedureCode: '99213', adjudication: [adjudication(ADJUDICATION_CODES.PAID, 60)] }),
      ],
    });

    const lines = buildEraRemitServiceLines(cr, submittedClaim());

    expect(lines[0]).toMatchObject({
      itemSequence: 1,
      claimItemSequence: 2,
      cptCode: '87880',
      units: 2,
      billed: 50,
    });
    expect(lines[1]).toMatchObject({
      itemSequence: 2,
      claimItemSequence: 1,
      cptCode: '99213',
      modifiers: ['25'],
      billed: 100,
    });
  });

  it('assigns repeated codes one-to-one, preferring the submitted charge, leaving leftovers unenriched', () => {
    const claim = submittedClaim({
      created: '2026-07-01',
      item: [
        {
          sequence: 1,
          productOrService: { coding: [{ code: '99213' }] },
          modifier: [{ coding: [{ code: '25' }] }],
          servicedPeriod: { start: '2026-07-09' },
          net: { value: 100, currency: 'USD' },
        },
        {
          sequence: 2,
          productOrService: { coding: [{ code: '99213' }] },
          servicedDate: '2026-07-10',
          net: { value: 50, currency: 'USD' },
        },
      ],
    });
    // positional sequences that exist nowhere on the claim; the middle line's charge picks line 2
    const cr = claimResponse({
      item: [
        eraItem({
          sequence: 4,
          procedureCode: '99213',
          adjudication: [adjudication(ADJUDICATION_CODES.CHARGE, 50), adjudication(ADJUDICATION_CODES.PAID, 30)],
        }),
        eraItem({
          sequence: 5,
          procedureCode: '99213',
          adjudication: [adjudication(ADJUDICATION_CODES.CHARGE, 100), adjudication(ADJUDICATION_CODES.PAID, 60)],
        }),
        eraItem({
          sequence: 6,
          procedureCode: '99213',
          adjudication: [adjudication(ADJUDICATION_CODES.CHARGE, 25), adjudication(ADJUDICATION_CODES.PAID, 0)],
        }),
      ],
    });

    const lines = buildEraRemitServiceLines(cr, claim);

    // charge 50 -> our line 2; charge 100 -> our line 1; the third has no line left to borrow from
    expect(lines[0]).toMatchObject({
      claimItemSequence: 2,
      modifiers: [],
      serviceDate: '2026-07-10',
      billed: 50,
    });
    expect(lines[1]).toMatchObject({
      claimItemSequence: 1,
      modifiers: ['25'],
      serviceDate: '2026-07-09',
      billed: 100,
    });
    expect(lines[2]).toMatchObject({
      claimItemSequence: null,
      modifiers: [],
      serviceDate: '2026-07-09',
      billed: 25,
    });
  });

  it('never borrows another service line details when the remit code is not on the claim', () => {
    const cr = claimResponse({
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '90717',
          adjudication: [adjudication(ADJUDICATION_CODES.CHARGE, 20), adjudication(ADJUDICATION_CODES.PAID, 0)],
        }),
      ],
    });

    const lines = buildEraRemitServiceLines(cr, submittedClaim());

    expect(lines[0]).toMatchObject({
      cptCode: '90717',
      claimItemSequence: null,
      modifiers: [],
      units: null,
      // falls back to the claim's own date rather than line 1's details
      serviceDate: '2026-07-09',
      billed: 20,
    });
  });

  it('keeps the claim-level addItem bucket separate from real service lines', () => {
    const cr = claimResponse({
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '99213',
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 30), casAdjustment('PR', 10, '2')],
        }),
      ],
      addItem: [
        {
          productOrService: { coding: [{ code: 'unknown' }] },
          adjudication: [casAdjustment('PR', 5, '3')],
        },
      ],
    });

    const lines = buildEraRemitServiceLines(cr, undefined);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ cptCode: '99213', coinsurance: 10, isClaimLevel: false });
    expect(lines[1]).toMatchObject({
      itemSequence: null,
      claimItemSequence: null,
      isClaimLevel: true,
      cptCode: '',
      copay: 5,
      serviceDate: '',
    });
  });

  it('resolves a payer-added addItem line only when it carries the procedure code extension', () => {
    const withoutExtension = claimResponse({
      addItem: [
        {
          productOrService: {
            coding: [
              {
                code: '87880',
              },
            ],
          },
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 25)],
        },
      ],
    });
    const withExtension = claimResponse({
      addItem: [
        {
          productOrService: {
            coding: [
              {
                code: '87880',
              },
            ],
          },
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 25)],
          extension: [
            {
              url: ERA_ITEM_PROCEDURE_CODE_EXTENSION,
              valueString: '87880',
            },
          ],
        },
      ],
    });

    expect(buildEraRemitServiceLines(withoutExtension, submittedClaim())[0]).toMatchObject({
      isClaimLevel: false,
      cptCode: '87880',
      claimItemSequence: null,
      paid: 25,
    });
    expect(buildEraRemitServiceLines(withExtension, submittedClaim())[0]).toMatchObject({
      isClaimLevel: false,
      cptCode: '87880',
      claimItemSequence: 2,
      paid: 25,
    });
  });

  it('supports the B6 allowed qualifier from the other converter', () => {
    const cr = claimResponse({
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '99213',
          adjudication: [adjudication(ADJUDICATION_CODES.PAID, 60), adjudication(ADJUDICATION_CODES.ALLOWED_X12, 80)],
        }),
      ],
    });

    expect(buildEraRemitServiceLines(cr, undefined)[0].allowed).toBe(80);
  });

  it('falls back to amounts-only when the remit carries no procedure code at all', () => {
    const cr = claimResponse({
      item: [{ itemSequence: 7, adjudication: [adjudication(ADJUDICATION_CODES.PAID, 60)] }],
    });

    expect(buildEraRemitServiceLines(cr, undefined)[0]).toMatchObject({
      itemSequence: 7,
      claimItemSequence: null,
      cptCode: '',
      units: null,
      serviceDate: '',
      billed: null,
      paid: 60,
    });
  });
});

describe('eraPatientAccountNumber', () => {
  it('prefers the CLP01 the payer echoed on the remit', () => {
    const cr = claimResponse({ extension: eraExtensions({ pcn: 'FKFQGCL3M6M3VR' }) });
    expect(eraPatientAccountNumber([cr], submittedClaim(), true)).toBe('FKFQGCL3M6M3VR');
    expect(eraPatientAccountNumber([cr], undefined, false)).toBe('FKFQGCL3M6M3VR');
  });

  it("falls back to our own claim's PCN only when matched", () => {
    const cr = claimResponse();
    const claim = submittedClaim({ identifier: [{ system: CLAIM_PCN_IDENTIFIER_SYSTEM, value: 'PCN-42' }] });
    expect(eraPatientAccountNumber([cr], claim, true)).toBe('PCN-42');
    expect(eraPatientAccountNumber([cr], submittedClaim({ id: 'aaaa-bbbb' }), true)).toBe('aaaabbbb');
    // an unmatched row's claim id is synthetic, so it must never leak out as an account number
    expect(eraPatientAccountNumber([cr], submittedClaim({ id: 'unmatched-cr-1' }), false)).toBe('');
    expect(eraPatientAccountNumber([], undefined, false)).toBe('');
  });
});

describe('buildEraClaimRemit', () => {
  it('reads CLP02 and the payer claim control number from the era extensions', () => {
    const cr = claimResponse({
      extension: eraExtensions({ statusCode: '1', pcn: 'FKFQGCL3M6M3VR', icn: 'BTCN7WB7FC00' }),
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '99214',
          adjudication: [
            adjudication(ADJUDICATION_CODES.CHARGE, 380),
            adjudication(ADJUDICATION_CODES.PAID, 55.32),
            adjudication(ADJUDICATION_CODES.ALLOWED, 55.32),
            casAdjustment('CO', 324.68, '45'),
          ],
        }),
      ],
    });

    const remit = buildEraClaimRemit(cr, undefined);

    expect(remit).toMatchObject({
      claimResponseId: 'cr-1',
      created: '2026-07-15',
      outcome: 'complete',
      eraStatusCode: '1',
      payerClaimControlNumber: 'BTCN7WB7FC00',
      allowed: 55.32,
      paid: 55.32,
      notes: [],
    });
    expect(remit.serviceLines[0].cptCode).toBe('99214');
  });

  it('aggregates patient responsibility per reason code across lines', () => {
    const cr = claimResponse({
      item: [
        eraItem({ sequence: 1, adjudication: [casAdjustment('PR', 10.005, '2')] }),
        eraItem({ sequence: 2, adjudication: [casAdjustment('PR', 5, '2'), casAdjustment('CO', 40, '45')] }),
        eraItem({ sequence: 3, adjudication: [casAdjustment('PR', 25, '1')] }),
      ],
    });

    expect(buildEraClaimRemit(cr, undefined).patientRespAdjustments).toEqual([
      { groupCode: 'PR', reasonCode: '2', amount: 15.01 },
      { groupCode: 'PR', reasonCode: '1', amount: 25 },
    ]);
  });

  it('passes reversals through with their negative amounts', () => {
    const cr = claimResponse({
      extension: eraExtensions({ statusCode: '22' }),
      item: [
        eraItem({
          sequence: 1,
          procedureCode: '73140',
          adjudication: [
            adjudication(ADJUDICATION_CODES.CHARGE, -116),
            adjudication(ADJUDICATION_CODES.PAID, -14.46),
            casAdjustment('CO', -101.54, '45'),
          ],
        }),
      ],
    });

    const remit = buildEraClaimRemit(cr, undefined);

    expect(remit.eraStatusCode).toBe('22');
    expect(remit.paid).toBe(-14.46);
    expect(remit.serviceLines[0]).toMatchObject({ billed: -116, cptCode: '73140' });
  });
});

describe('resolveEraPayee', () => {
  const payeeOrg: Organization = {
    resourceType: 'Organization',
    id: 'billing-provider',
    identifier: [
      { system: FHIR_IDENTIFIER_NPI, value: '1871112375' },
      {
        type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: FHIR_IDENTIFIER_CODE_TAX_EMPLOYER }] },
        value: '123456789',
      },
    ],
  };

  it('reads the billing provider the contained claim points at', () => {
    const cr = claimResponse({ contained: [containedClaim(), payeeOrg] });
    expect(resolveEraPayee([cr])).toEqual({ name: '', npi: '1871112375', taxId: '123456789' });
  });

  it('includes the organization name when the converter supplies one', () => {
    const cr = claimResponse({
      contained: [containedClaim(), { ...payeeOrg, name: 'Ottehr Medical Group' }],
    });
    expect(resolveEraPayee([cr])?.name).toBe('Ottehr Medical Group');
  });

  it('skips remits with no payee and returns null when no remit has one', () => {
    const bare = claimResponse({ id: 'cr-bare' });
    const withPayee = claimResponse({ id: 'cr-payee', contained: [containedClaim(), payeeOrg] });
    expect(resolveEraPayee([bare, withPayee])?.npi).toBe('1871112375');
    // matched responses lose their contained resources entirely
    expect(resolveEraPayee([bare])).toBeNull();
    expect(resolveEraPayee([])).toBeNull();
  });
});

describe('eraContainedMemberId', () => {
  const memberIdentifier = {
    type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: 'MB' }] },
    value: 'MBR-777',
  };
  const containedSubscriber: Patient = {
    resourceType: 'Patient',
    id: 'subscriber',
    identifier: [{ value: 'other-id' }, memberIdentifier],
  };
  const containedCoverage = (overrides: Partial<Coverage> = {}): Coverage =>
    ({
      resourceType: 'Coverage',
      id: 'coverage',
      status: 'active',
      subscriber: { reference: '#subscriber' },
      beneficiary: { reference: '#patient' },
      payor: [{ display: 'Acme' }],
      ...overrides,
    }) as Coverage;

  it('prefers the contained Coverage subscriberId when present', () => {
    const cr = claimResponse({
      contained: [containedClaim(), containedCoverage({ subscriberId: 'SUB-1' }), containedSubscriber],
    });
    expect(eraContainedMemberId(cr)).toBe('SUB-1');
  });

  it('reads the NM109 member identifier off the contained subscriber resource', () => {
    const cr = claimResponse({
      contained: [containedClaim(), containedCoverage(), containedSubscriber],
    });
    expect(eraContainedMemberId(cr)).toBe('MBR-777');
  });

  it('falls back to a Coverage identifier, then a typed member identifier on the contained patient', () => {
    const viaCoverage = claimResponse({
      contained: [containedClaim(), containedCoverage({ subscriber: undefined, identifier: [{ value: 'COV-9' }] })],
    });
    expect(eraContainedMemberId(viaCoverage)).toBe('COV-9');

    // patient = subscriber: the 835 puts the member id on NM1*QC (qualifier MI), no NM1*IL loop
    const viaPatient = claimResponse({
      patient: { reference: '#patient' },
      contained: [containedClaim(), { resourceType: 'Patient', id: 'patient', identifier: [memberIdentifier] }],
    });
    expect(eraContainedMemberId(viaPatient)).toBe('MBR-777');
  });

  it('ignores untyped identifiers on the contained patient — they may be a medical record number', () => {
    const cr = claimResponse({
      patient: { reference: '#patient' },
      contained: [containedClaim(), { resourceType: 'Patient', id: 'patient', identifier: [{ value: 'MRN-1' }] }],
    });
    expect(eraContainedMemberId(cr)).toBe('');
  });

  it('is empty for matched remits, which carry no contained resources', () => {
    expect(eraContainedMemberId(claimResponse())).toBe('');
  });
});
