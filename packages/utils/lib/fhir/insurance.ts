import { NetworkType } from 'candidhealth/api/resources/preEncounter/resources/coverages/resources/v1';
import { Coding } from 'fhir/r4b';

export const CANDID_PLAN_TYPE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/candid-plan-type';

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
  {
    candidCode: '11',
    label: 'Other Non-Federal Programs',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'PUBLICPOL',
    },
  },
  {
    candidCode: '12',
    label: 'PPO',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'PPO',
    },
  },
  {
    candidCode: '13',
    label: 'POS',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'POS',
    },
  },
  {
    candidCode: '14',
    label: 'EPO',
    coverageCoding: {
      system: 'https://nahdo.org/sopt',
      code: '515',
      display: 'Commercial Managed Care - EPO',
    },
  },
  {
    candidCode: '15',
    label: 'Indemnity Insurance',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'HIP',
      display: 'health insurance plan',
    },
  },
  {
    candidCode: '16',
    label: 'HMO Medicare Risk',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'MCPOL',
      display: 'managed care policy',
    },
  },
  {
    candidCode: '17',
    label: 'DMO',
    coverageCoding: {
      system: 'http://nucc.org/provider-taxonomy',
      code: '1223D0001X',
      display: 'Dental, Dental Public Health',
    },
  },
  {
    candidCode: 'AM',
    label: 'Auto',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AUTOPOL',
    },
  },
  {
    candidCode: 'BL',
    label: 'BlueCross BlueShield',
  },
  {
    candidCode: 'CH',
    label: 'Champus',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'PUBLICPOL',
      display: 'public healthcare',
    },
  },
  {
    candidCode: 'CI',
    label: 'Commercial Insurance Co',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'COMM',
      display: 'Commercial',
    },
  },
  {
    candidCode: 'DS',
    label: 'Disability',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'DIS',
    },
  },
  {
    candidCode: 'FI',
    label: 'Federal Employees',
    coverageCoding: {
      system: 'http://hl7.org/fhir/us/directory-attestation/CodeSystem/InsuranceProductTypeCS',
      code: 'fep',
      display: 'Federal Employee Program',
    },
  },
  {
    candidCode: 'HM',
    label: 'HMO',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'HMO',
    },
  },
  {
    candidCode: 'LM',
    label: 'Liability',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'LIAB',
      display: 'liability insurance',
    },
  },
  {
    candidCode: 'MA',
    label: 'Medicare Part A',
    coverageCoding: {
      system: 'http://hl7.org/fhir/us/directory-attestation/CodeSystem/InsuranceProductTypeCS',
      code: 'media',
      display: 'Medicare Part A',
    },
  },
  {
    candidCode: 'MB',
    label: 'Medicare Part B',
    coverageCoding: {
      system: 'http://hl7.org/fhir/us/directory-attestation/CodeSystem/InsuranceProductTypeCS',
      code: 'medib',
      display: 'Medicare Part B',
    },
  },
  {
    candidCode: 'MC',
    label: 'Medicaid',
  },
  {
    candidCode: 'OF',
    label: 'Other Federal Program',
  },
  {
    candidCode: 'TV',
    label: 'Title V',
  },
  {
    candidCode: 'VA',
    label: 'Veterans Affairs Plan',
    coverageCoding: {
      system: 'http://hl7.org/fhir/us/directory-attestation/CodeSystem/InsuranceProductTypeCS',
      code: 'va',
      display: 'Veterans Affairs',
    },
  },
  {
    candidCode: 'WC',
    label: 'Workers Comp Health Claim',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'WCBPOL',
    },
  },
  {
    candidCode: 'ZZ',
    label: 'Mutually Defined',
  },
];

export const INSURANCE_CANDID_PLAN_TYPE_CODES = InsurancePlanTypes.map((planType) => planType.candidCode) as string[];
