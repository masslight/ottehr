import { Coding, Coverage, CoverageEligibilityResponse } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { CODE_SYSTEM_CPT_MODIFIER, EXTENSION_URL_CPT_MODIFIER } from '../helpers/rcm/constants';
import { CoverageCheckWithDetails } from '../types/api/patient-account';
import { InsuranceEligibilityCheckStatus } from '../types/data/paperwork/paperwork.types';
import { PatientPaymentBenefit } from '../types/data/telemed/eligibility.types';
import {
  extractCptCodeModifiersFromCoding,
  formatEligibilityMoney,
  formatPatientPaymentBenefitAmount,
  getCptBillableUnitsFromCoding,
  getEligibilityCheckDetailsForCoverage,
  getEligibilityErrorDetails,
  getFinancialDetailSummary,
  getPatientPaymentBenefitsByNetwork,
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

describe('getEligibilityCheckDetailsForCoverage', () => {
  const coverage = (subscriberId: string, payer: string): Coverage => ({
    resourceType: 'Coverage',
    status: 'active',
    beneficiary: { reference: 'Patient/patient-1' },
    subscriberId,
    payor: [{ reference: payer }],
    class: [
      {
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'plan' }] },
        value: 'x',
      },
    ],
  });
  const check = (dateISO: string, subscriberId: string, payorRef: string): CoverageCheckWithDetails => ({
    status: InsuranceEligibilityCheckStatus.eligibilityConfirmed,
    dateISO,
    subscriberId,
    payorRef,
  });
  const AETNA = 'https://rcm-api.zapehr.com/v1/payer/60054';
  const CIGNA = 'https://rcm-api.zapehr.com/v1/payer/62308';

  it('returns the first matching check, the newest since checks arrive newest first', () => {
    const checks = [check('2026-11-02T10:00:00.000Z', 'A-1', AETNA), check('2026-11-01T10:00:00.000Z', 'A-1', AETNA)];
    expect(getEligibilityCheckDetailsForCoverage(coverage('A-1', AETNA), checks)).toBe(checks[0]);
  });

  it('skips checks that belong to another coverage', () => {
    const checks = [check('2026-11-02T10:00:00.000Z', 'C-9', CIGNA), check('2026-11-01T10:00:00.000Z', 'A-1', AETNA)];
    expect(getEligibilityCheckDetailsForCoverage(coverage('A-1', AETNA), checks)).toBe(checks[1]);
  });

  it('finds nothing once the coverage member ID no longer matches the earlier check', () => {
    const checks = [check('2026-11-01T10:00:00.000Z', 'A-1', AETNA)];
    expect(getEligibilityCheckDetailsForCoverage(coverage('A-2', AETNA), checks)).toBeUndefined();
  });
});

describe('eligibility display helpers', () => {
  const benefit = (overrides: Partial<PatientPaymentBenefit>): PatientPaymentBenefit =>
    ({
      amountInUSD: 0,
      percentage: 0,
      code: 'UC',
      description: 'Urgent Care',
      coverageCode: 'B',
      coverageDescription: 'Co-Payment',
      periodDescription: 'Visit',
      periodCode: '27',
      levelDescription: 'Individual',
      levelCode: 'IND',
      inNetwork: true,
      ...overrides,
    }) as PatientPaymentBenefit;

  it('keeps only urgent care benefits and splits them by network', () => {
    const inNetwork = benefit({ amountInUSD: 25 });
    const outOfNetwork = benefit({ amountInUSD: 75, inNetwork: false });
    const otherService = benefit({ code: '98', amountInUSD: 10 });
    expect(getPatientPaymentBenefitsByNetwork([inNetwork, outOfNetwork, otherService])).toEqual({
      inNetwork: [inNetwork],
      outOfNetwork: [outOfNetwork],
    });
  });

  it.each([
    [{ coverageCode: 'B', amountInUSD: 25 }, '$25'],
    [{ coverageCode: 'B', percentage: 20 }, '20%'],
    [{ coverageCode: 'B' }, '$0'],
    [{ coverageCode: 'A', percentage: 20, amountInUSD: 25 }, '20%'],
    [{ coverageCode: 'A', amountInUSD: 25 }, '$25'],
    [{ coverageCode: 'A' }, '0%'],
  ] as const)('formats a %o benefit as %s', (overrides, expected) => {
    expect(formatPatientPaymentBenefitAmount(benefit(overrides))).toBe(expected);
  });

  it('formats money as US dollars and an unknown amount as Unknown', () => {
    expect(formatEligibilityMoney(1000)).toBe('$1,000.00');
    expect(formatEligibilityMoney(0)).toBe('$0.00');
    expect(formatEligibilityMoney(undefined)).toBe('Unknown');
  });

  it('summarizes a financial detail only when it has no positive amount', () => {
    expect(getFinancialDetailSummary({ name: 'Individual Deductible', paid: 400, total: 1000, remaining: 600 })).toBe(
      undefined
    );
    expect(getFinancialDetailSummary({ name: 'Family Deductible', paid: 0, total: undefined, remaining: 0 })).toBe(
      '$0'
    );
    expect(
      getFinancialDetailSummary({ name: 'Out-of-Pocket Max', paid: undefined, total: undefined, remaining: undefined })
    ).toBe('Unspecified');
  });

  it('extracts error codes and messages with the fallbacks the Insurance card shows', () => {
    expect(getEligibilityErrorDetails(undefined)).toBeUndefined();
    expect(getEligibilityErrorDetails({ errors: [] })).toBeUndefined();
    expect(
      getEligibilityErrorDetails({
        errors: [
          { code: { coding: [{ code: 'ml-410' }], text: 'Not supported' } },
          { code: { text: 'Only text' } },
          { code: {} },
        ],
      })
    ).toEqual([
      { code: 'ml-410', text: 'Not supported' },
      { code: 'Only text', text: 'Only text' },
      { code: 'UNKNOWN', text: 'No error details available' },
    ]);
  });
});
