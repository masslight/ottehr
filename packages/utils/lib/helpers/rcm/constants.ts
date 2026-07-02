import { OYSTEHR_EXTENSION_BASE_URL } from '../../fhir/constants';

export const EMERGENCY_REVENUE_CODE = '1001';

export const EXTENSION_PATIENT_PAID = 'http://fhir-api.zapehr.com/extension/patient-paid';
export const EXTENSION_PATIENT_ACCOUNT_NUMBER = 'http://fhir-api.zapehr.com/extension/patient-account-number';
export const EXTENSION_PATIENT_SIGNED_DATE = 'http://fhir-api.zapehr.com/extension/patient-signed-date';
export const EXTENSION_PRACTITIONER_SIGNED_DATE = 'http://fhir-api.zapehr.com/extension/practitioner-signed-date';
export const EXTENSION_CLAIM_CONDITION_CODE = 'http://fhir-api.zapehr.com/extension/claim-condition-code';
export const EXTENSION_OUTSIDE_CHARGES = 'http://fhir-api.zapehr.com/extension/outside-charges';
export const RAW_RESPONSE = 'http://fhir-api.zapehr.com/extension/raw-response';

export const EXTENSION_CLAIM_INSURANCE_TYPE = `${OYSTEHR_EXTENSION_BASE_URL}/rcm-claim-insurance-type`;

export const EXTENSION_CLAIM_PROVIDER_SIGNATURE_INDICATOR = `${OYSTEHR_EXTENSION_BASE_URL}/rcm-claim-provider-signature-indicator`;
export const EXTENSION_CLAIM_ASSIGNMENT_OR_PLAN_PARTICIPATION_CODE = `${OYSTEHR_EXTENSION_BASE_URL}/rcm-claim-assignment-or-plan-participation-code`;
export const EXTENSION_CLAIM_BENEFITS_ASSIGNMENT_CERTIFICATION_INDICATOR = `${OYSTEHR_EXTENSION_BASE_URL}/rcm-claim-benefits-assignment-certification-indicator`;
export const EXTENSION_CLAIM_RELEASE_OF_INFORMATION_CODE = `${OYSTEHR_EXTENSION_BASE_URL}/rcm-claim-release-of-information-code`;

export const CODE_SYSTEM_CLAIM_TYPE = 'http://terminology.hl7.org/CodeSystem/claim-type';
export const CODE_SYSTEM_PROCESS_PRIORITY = 'http://terminology.hl7.org/CodeSystem/processpriority';
export const CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY = 'http://terminology.hl7.org/CodeSystem/claiminformationcategory';
export const CODE_SYSTEM_ACT_CODE_V3 = 'http://terminology.hl7.org/CodeSystem/v3-ActCode';
export const CODE_SYSTEM_ICD_9 = 'http://hl7.org/fhir/sid/icd-9-cm';
export const CODE_SYSTEM_ICD_10 = 'http://hl7.org/fhir/sid/icd-10-cm';
export const CODE_SYSTEM_CPT = 'http://www.ama-assn.org/go/cpt'; // used by both Ottehr and Oystehr
export const CODE_SYSTEM_HCPCS = 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets'; // used by Ottehr clinical in-house meds
export const CODE_SYSTEM_HL7_HCPCS = 'http://terminology.hl7.org/CodeSystem/HCPCS'; // used by Oystehr RCM
export const CODE_SYSTEM_NDC = 'http://hl7.org/fhir/sid/ndc';
export const CODE_SYSTEM_CMS_PLACE_OF_SERVICE =
  'http://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set.html';

// https://www.cms.gov/medicare/coding-billing/place-of-service-codes/code-sets
export const CMS_PLACE_OF_SERVICE_CODES: readonly { code: string; display: string }[] = [
  {
    code: '01',
    display: 'Pharmacy',
  },
  {
    code: '02',
    display: "Telehealth Provided Other than in Patient's Home",
  },
  {
    code: '03',
    display: 'School',
  },
  {
    code: '04',
    display: 'Homeless Shelter',
  },
  {
    code: '05',
    display: 'Indian Health Service Free-standing Facility',
  },
  {
    code: '06',
    display: 'Indian Health Service Provider-based Facility',
  },
  {
    code: '07',
    display: 'Tribal 638 Free-standing Facility',
  },
  {
    code: '08',
    display: 'Tribal 638 Provider-based Facility',
  },
  {
    code: '09',
    display: 'Prison/Correctional Facility',
  },
  {
    code: '10',
    display: "Telehealth Provided in Patient's Home",
  },
  {
    code: '11',
    display: 'Office',
  },
  {
    code: '12',
    display: 'Home',
  },
  {
    code: '13',
    display: 'Assisted Living Facility',
  },
  {
    code: '14',
    display: 'Group Home',
  },
  {
    code: '15',
    display: 'Mobile Unit',
  },
  {
    code: '16',
    display: 'Temporary Lodging',
  },
  {
    code: '17',
    display: 'Walk-in Retail Health Clinic',
  },
  {
    code: '18',
    display: 'Place of Employment-Worksite',
  },
  {
    code: '19',
    display: 'Off Campus-Outpatient Hospital',
  },
  {
    code: '20',
    display: 'Urgent Care Facility',
  },
  {
    code: '21',
    display: 'Inpatient Hospital',
  },
  {
    code: '22',
    display: 'On Campus-Outpatient Hospital',
  },
  {
    code: '23',
    display: 'Emergency Room - Hospital',
  },
  {
    code: '24',
    display: 'Ambulatory Surgical Center',
  },
  {
    code: '25',
    display: 'Birthing Center',
  },
  {
    code: '26',
    display: 'Military Treatment Facility',
  },
  {
    code: '27',
    display: 'Outreach Site/Street',
  },
  {
    code: '31',
    display: 'Skilled Nursing Facility',
  },
  {
    code: '32',
    display: 'Nursing Facility',
  },
  {
    code: '33',
    display: 'Custodial Care Facility',
  },
  {
    code: '34',
    display: 'Hospice',
  },
  {
    code: '41',
    display: 'Ambulance - Land',
  },
  {
    code: '42',
    display: 'Ambulance - Air or Water',
  },
  {
    code: '49',
    display: 'Independent Clinic',
  },
  {
    code: '50',
    display: 'Federally Qualified Health Center',
  },
  {
    code: '51',
    display: 'Inpatient Psychiatric Facility',
  },
  {
    code: '52',
    display: 'Psychiatric Facility-Partial Hospitalization',
  },
  {
    code: '53',
    display: 'Community Mental Health Center',
  },
  {
    code: '54',
    display: 'Intermediate Care Facility/Individuals with Intellectual Disabilities',
  },
  {
    code: '55',
    display: 'Residential Substance Abuse Treatment Facility',
  },
  {
    code: '56',
    display: 'Psychiatric Residential Treatment Center',
  },
  {
    code: '57',
    display: 'Non-residential Substance Abuse Treatment Facility',
  },
  {
    code: '58',
    display: 'Non-residential Opioid Treatment Facility',
  },
  {
    code: '60',
    display: 'Mass Immunization Center',
  },
  {
    code: '61',
    display: 'Comprehensive Inpatient Rehabilitation Facility',
  },
  {
    code: '62',
    display: 'Comprehensive Outpatient Rehabilitation Facility',
  },
  {
    code: '65',
    display: 'End-Stage Renal Disease Treatment Facility',
  },
  {
    code: '66',
    display: 'Programs of All-Inclusive Care for the Elderly (PACE) Center',
  },
  {
    code: '71',
    display: 'Public Health Clinic',
  },
  {
    code: '72',
    display: 'Rural Health Clinic',
  },
  {
    code: '81',
    display: 'Independent Laboratory',
  },
  {
    code: '99',
    display: 'Other Place of Service',
  },
] as const;
export const CMS_PLACE_OF_SERVICE_CODE_SET = new Set(CMS_PLACE_OF_SERVICE_CODES.map((pos) => pos.code));

export const CODE_SYSTEM_COVERAGE_CLASS = 'http://terminology.hl7.org/CodeSystem/coverage-class';
export const CODE_SYSTEM_PAYEE_TYPE = 'http://terminology.hl7.org/CodeSystem/payeetype';
export const CODE_SYSTEM_PROVIDER_TAXONOMY = 'http://nucc.org/provider-taxonomy';

export const CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REFERRING_PROVIDER_TYPE =
  'https://terminology.zapehr.com/rcm/cms1500/referring-provider-type';
export const CODE_SYSTEM_OYSTEHR_RCM_CMS1500_DATE_TYPE = 'https://terminology.zapehr.com/rcm/cms1500/date-type';
export const CODE_SYSTEM_OYSTEHR_RCM_CMS1500_RESUBMISSION_RELATIONSHIP =
  'https://terminology.zapehr.com/rcm/cms1500/resubmission-relationship';
export const CODE_SYSTEM_OYSTEHR_RCM_CMS1500_PROCEDURE_MODIFIER =
  'https://terminology.zapehr.com/rcm/cms1500/procedure-modifier';
export const CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REVENUE_CODE = 'https://terminology.zapehr.com/rcm/cms1500/revenue-code';

export const EXTENSION_URL_CPT_MODIFIER = 'https://fhir.ottehr.com/Extension/cpt-code-modifier';
export const CODE_SYSTEM_CPT_MODIFIER = 'https://fhir.ottehr.com/CodeSystem/cpt-code-modifier';

export const CODE_SYSTEM_OYSTEHR_CLAIM_PROCEDURE_MODIFIER =
  'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier';

export const CODE_SYSTEM_CLAIM_TYPE_CODE_NAMES = ['professional', 'institutional'] as const;
export const CODE_SYSTEM_CLAIM_TYPE_CODES = {
  professional: 'professional',
  institutional: 'institutional',
} as const;

export const CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/billing-service';
export const CODE_SYSTEM_SERVICE_CATEGORY_CODE_NAMES = [
  'urgent-care',
  'occupational-medicine',
  'workers-comp',
  'pre-op',
] as const;
export const CODE_SYSTEM_SERVICE_CATEGORY_CODES = {
  'urgent-care': 'urgent-care',
  'occupational-medicine': 'occupational-medicine',
  'workers-comp': 'workers-comp',
  'pre-op': 'pre-op',
} as const;
