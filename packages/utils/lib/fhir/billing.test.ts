import { Coding, CoverageEligibilityResponse } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { CODE_SYSTEM_CPT_MODIFIER, EXTENSION_URL_CPT_MODIFIER } from '../helpers/rcm/constants';
import { InsuranceEligibilityCheckStatus } from '../types/data/paperwork/paperwork.types';
import {
  extractCptCodeModifiersFromCoding,
  getCptBillableUnitsFromCoding,
  INSURANCE_TYPE_CODE_TO_CANDID_CODE,
  mapInsuranceTypeCodeToCandidCode,
  parseCoverageEligibilityResponse,
} from './billing';
import { CPT_BILLABLE_UNITS_EXTENSION_URL } from './constants';
import { INSURANCE_CANDID_PLAN_TYPE_CODES } from './insurance';

describe('parseCoverageEligibilityResponse error classification', () => {
  const errorResponse = (system: string | undefined, code: string, text: string): CoverageEligibilityResponse => ({
    resourceType: 'CoverageEligibilityResponse',
    status: 'active',
    purpose: ['benefits'],
    patient: { reference: 'Patient/patient-1' },
    created: '2026-10-23T17:37:59.585Z',
    request: { reference: 'CoverageEligibilityRequest/request-1' },
    insurer: { reference: 'Organization/payer' },
    outcome: 'error',
    error: [{ code: { coding: [{ ...(system ? { system } : {}), code }], text } }],
  });

  it.each([
    [
      'https://terminology.fhir.oystehr.com/CodeSystem/error',
      '410',
      'Payer ID [13162] does not support real-time eligibility.',
    ],
    [
      'https://terminology.fhir.oystehr.com/CodeSystem/rcm-eligibility-error',
      'ml-410',
      'Real-time eligibility checks are not supported for payer: Acclaim (64071)',
    ],
  ])('treats %s|%s as a payer that does not support real-time eligibility', (system, code, text) => {
    expect(parseCoverageEligibilityResponse(errorResponse(system, code, text)).status).toBe(
      InsuranceEligibilityCheckStatus.eligibilityCheckNotSupported
    );
  });

  it.each([
    [undefined, '75', 'Subscriber/Insured Not Found'],
    ['https://terminology.fhir.oystehr.com/CodeSystem/rcm-eligibility-error', 'ml-75', 'Subscriber/Insured Not Found'],
    ['https://terminology.fhir.oystehr.com/CodeSystem/error', '430B', 'ERROR- Tax ID number invalid.'],
    ['https://terminology.fhir.oystehr.com/CodeSystem/error', '4100', 'Similar code'],
    ['https://terminology.fhir.oystehr.com/CodeSystem/rcm-eligibility-error', 'ml-4100', 'Similar code'],
  ])('keeps %s|%s as not confirmed', (system, code, text) => {
    expect(parseCoverageEligibilityResponse(errorResponse(system, code, text)).status).toBe(
      InsuranceEligibilityCheckStatus.eligibilityNotConfirmed
    );
  });
});

describe('parseCoverageEligibilityResponse subscriber DOB and address', () => {
  const COMPLETE_ELIG = {
    ins_name_f: 'Jerome',
    ins_name_l: 'Black',
    ins_dob: '19990110',
    ins_number: 'A-123',
    ins_addr_1: 'Old Town Road, 123',
    ins_city: 'New York',
    ins_state: 'NY',
    ins_zip: '12345',
  };

  const subscriberFor = (elig: Record<string, string | undefined>): Record<string, unknown> | undefined =>
    parseCoverageEligibilityResponse({
      resourceType: 'CoverageEligibilityResponse',
      status: 'active',
      purpose: ['benefits'],
      patient: { reference: 'Patient/patient-1' },
      created: '2026-11-20T14:30:00.000Z',
      request: { reference: 'CoverageEligibilityRequest/request-1' },
      insurer: { reference: 'Organization/payer' },
      outcome: 'complete',
      insurance: [
        {
          coverage: { reference: 'Coverage/coverage-1' },
          item: [{ category: { coding: [{ code: '30' }] }, benefit: [{ type: { text: 'Active Coverage' } }] }],
        },
      ],
      extension: [
        {
          url: 'https://extensions.fhir.oystehr.com/raw-response',
          valueString: JSON.stringify({ elig: { ...elig, benefit: [] } }),
        },
      ],
    }).coverageDetails?.subscriber;

  it('formats a complete DOB and address exactly as before', () => {
    expect(subscriberFor(COMPLETE_ELIG)).toMatchObject({
      dateOfBirth: '01/10/1999',
      address: 'Old Town Road, 123 New York, NY 12345',
    });
  });

  it('leaves the DOB and address empty when the payer reports none of their parts', () => {
    const subscriber = subscriberFor({
      ...COMPLETE_ELIG,
      ins_dob: undefined,
      ins_addr_1: undefined,
      ins_city: undefined,
      ins_state: undefined,
      ins_zip: undefined,
    });
    expect(subscriber?.dateOfBirth).toBeUndefined();
    expect(subscriber?.address).toBeUndefined();
    expect(subscriber?.memberID).toBe('A-123');
  });

  it.each(['1999-01-10', '19991310'])('leaves the DOB empty when the payer reports the invalid date %s', (insDob) => {
    expect(subscriberFor({ ...COMPLETE_ELIG, ins_dob: insDob })?.dateOfBirth).toBeUndefined();
  });

  it.each([
    ['the street', { ins_addr_1: undefined }, 'New York, NY 12345'],
    ['the city', { ins_city: undefined }, 'Old Town Road, 123 NY 12345'],
    ['the state', { ins_state: undefined }, 'Old Town Road, 123 New York, 12345'],
    ['the ZIP code', { ins_zip: undefined }, 'Old Town Road, 123 New York, NY'],
    [
      'the city, state and ZIP code',
      { ins_city: undefined, ins_state: undefined, ins_zip: undefined },
      'Old Town Road, 123',
    ],
    ['everything but the state', { ins_addr_1: undefined, ins_city: undefined, ins_zip: undefined }, 'NY'],
  ])('prints only the address parts the payer reports when it omits %s', (_, missing, address) => {
    expect(subscriberFor({ ...COMPLETE_ELIG, ...missing })?.address).toBe(address);
  });
});

describe('extractCptCodeModifiersFromCoding', () => {
  it('returns modifiers from every modifier extension on the coding', () => {
    const coding: Coding = {
      code: '84591',
      extension: [
        {
          url: EXTENSION_URL_CPT_MODIFIER,
          valueCodeableConcept: { coding: [{ system: CODE_SYSTEM_CPT_MODIFIER, code: '91', display: 'Repeat' }] },
        },
        {
          url: EXTENSION_URL_CPT_MODIFIER,
          valueCodeableConcept: { coding: [{ system: CODE_SYSTEM_CPT_MODIFIER, code: '50', display: 'Bilateral' }] },
        },
      ],
    };
    expect(extractCptCodeModifiersFromCoding(coding)).toEqual([
      { code: '91', display: 'Repeat' },
      { code: '50', display: 'Bilateral' },
    ]);
  });

  it('returns an empty array when there is no modifier extension', () => {
    expect(extractCptCodeModifiersFromCoding({ code: '84591' })).toEqual([]);
  });
});

describe('getCptBillableUnitsFromCoding', () => {
  it('reads a positive unit count from the CPT coding extension', () => {
    const coding: Coding = {
      code: '13133',
      extension: [{ url: CPT_BILLABLE_UNITS_EXTENSION_URL, valueDecimal: 2 }],
    };

    expect(getCptBillableUnitsFromCoding(coding)).toBe(2);
  });

  it.each([0, -1, Number.NaN])('rejects an invalid unit count: %s', (value) => {
    const coding: Coding = {
      code: '13133',
      extension: [{ url: CPT_BILLABLE_UNITS_EXTENSION_URL, valueDecimal: value }],
    };

    expect(getCptBillableUnitsFromCoding(coding)).toBeUndefined();
  });
});

describe('mapInsuranceTypeCodeToCandidCode', () => {
  it.each([
    ['PR', '12'], // Preferred Provider Organization -> PPO
    ['PS', '13'], // Point of Service -> POS
    ['EP', '14'], // Exclusive Provider Organization -> EPO, NOT PPO
    ['PP', '09'], // Personal payment (cash, no insurance) -> Self Pay
    ['HM', 'HM'],
    ['MC', 'MC'],
  ])('maps X12 insurance type %s to candid code %s', (insuranceTypeCode, expected) => {
    expect(mapInsuranceTypeCodeToCandidCode(insuranceTypeCode)).toBe(expected);
  });

  it.each(['pr', ' PR ', 'Pr'])('normalizes the code before lookup: %s', (insuranceTypeCode) => {
    expect(mapInsuranceTypeCodeToCandidCode(insuranceTypeCode)).toBe('12');
  });

  it.each([undefined, '', 'NOT-A-CODE'])('returns undefined for %s', (insuranceTypeCode) => {
    expect(mapInsuranceTypeCodeToCandidCode(insuranceTypeCode)).toBeUndefined();
  });

  it('only maps to codes the insurance type dropdown offers', () => {
    const unknownTargets = Object.entries(INSURANCE_TYPE_CODE_TO_CANDID_CODE).filter(
      ([, candidCode]) => !INSURANCE_CANDID_PLAN_TYPE_CODES.includes(candidCode)
    );

    expect(unknownTargets).toEqual([]);
  });
});
