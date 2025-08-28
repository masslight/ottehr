import { NetworkType } from 'candidhealth/api/resources/preEncounter/resources/coverages/resources/v1';
import { Coding } from 'fhir/r4b';

export const INSURANCE_COVERAGE_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ActCode';

export interface InsurancePlanType {
  candidCode: NetworkType;
  label: string;
  coverageCoding?: Coding;
}

export const InsurancePlanTypes: InsurancePlanType[] = [
  {
    candidCode: '09',
    label: 'Self Pay',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
      code: 'pay',
    },
  },
  { candidCode: '11', label: 'Other Non-Federal Programs' },
  {
    candidCode: '12',
    label: 'PPO',
    coverageCoding: {
      system: INSURANCE_COVERAGE_TYPE_SYSTEM,
      code: 'PPO',
    },
  },
  {
    candidCode: '13',
    label: 'POS',
    coverageCoding: {
      system: INSURANCE_COVERAGE_TYPE_SYSTEM,
      code: 'POS',
    },
  },
  { candidCode: '14', label: 'EPO' },
  { candidCode: '15', label: 'Indemnity Insurance' },
  { candidCode: '16', label: 'HMO Medicare Risk' },
  { candidCode: '17', label: 'DMO' },
  { candidCode: 'AM', label: 'Auto' },
  { candidCode: 'BL', label: 'BlueCross BlueShield' },
  { candidCode: 'CH', label: 'Champus' },
  { candidCode: 'CI', label: 'Commercial Insurance Co' },
  { candidCode: 'DS', label: 'Disability' },
  { candidCode: 'FI', label: 'Federal Employees' },
  { candidCode: 'HM', label: 'HMO' },
  { candidCode: 'LM', label: 'Liability' },
  { candidCode: 'MA', label: 'Medicare Part A' },
  { candidCode: 'MB', label: 'Medicare Part B' },
  { candidCode: 'MC', label: 'Medicaid' },
  { candidCode: 'OF', label: 'Other Federal Program' },
  { candidCode: 'TV', label: 'Title V' },
  { candidCode: 'VA', label: 'Veterans Affairs Plan' },
  { candidCode: 'WC', label: 'Workers Comp Health Claim' },
  { candidCode: 'ZZ', label: 'Mutually Defined' },
];
