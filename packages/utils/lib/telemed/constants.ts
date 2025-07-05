import { OTTEHR_MODULE } from '../fhir';

export const ELIGIBILITY_BENEFIT_CODES = 'UC,86,30';
export const ELIGIBILITY_FAILED_REASON_META_TAG = `${OTTEHR_MODULE.TM}-eligibility-failed-reason`;
export const ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX = `${OTTEHR_MODULE.TM}-eligibility-billing-provider`;
export const ELIGIBILITY_RELATED_PERSON_META_TAG = `${OTTEHR_MODULE.TM}-eligibility-related-person`;
export const BYPASS_INSURANCE_NAME = 'zz admin';

export const ELIGIBILITY_FAILED_REASONS = {
  apiFailure: 'api-failure',
  eligibilityCheckDisabled: 'eligibility-check-disabled',
  realTimeEligibilityUnsupported: 'real-time-eligibility-unsupported',
};
export const ELIGIBILITY_PRACTITIONER_TYPES = ['individual', 'group'] as const;
export type EligibilityPractitionerType = (typeof ELIGIBILITY_PRACTITIONER_TYPES)[number];

export const SELF_PAY_CODING = {
  system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
  code: 'pay',
};

export const INSURANCE_COVERAGE_CODING = {
  system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  code: 'HIP',
};

export const INSURANCE_PLAN_ID_CODING = {
  system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
  code: 'pay',
};

// Sorted in order of appearance in telemed flow
export const QRS_TELEMED_COMMON_FIELDS = [
  'patient-street-address',
  'patient-street-address-2',
  'patient-city',
  'patient-state',
  'patient-zip',
  'patient-filling-out-as',
  'patient-number',
  'patient-email',
  'guardian-email',
  'guardian-number',
  'mobile-opt-in',
  'patient-ethnicity',
  'patient-race',
  'patient-pronouns',
  'patient-pronouns-custom',
  'pcp-first',
  'pcp-last',
  'pcp-number',
  // The strings don't match so have to map it before comparison
  'payment-option',
  'insurance-carrier',
  'insurance-member-id',
  'policy-holder-first-name',
  'policy-holder-middle-name',
  'policy-holder-last-name',
  'policy-holder-birth-sex',
  'policy-holder-address',
  'policy-holder-address-as-patient',
  'policy-holder-city',
  'policy-holder-state',
  'policy-holder-zip',
  'patient-relationship-to-insured',
  'insurance-additional-information',
  'insurance-card-front',
  'insurance-card-back',
  'insurance-carrier-2',
  'insurance-member-id-2',
  'policy-holder-first-name-2',
  'policy-holder-middle-name-2',
  'policy-holder-last-name-2',
  'policy-holder-birth-sex-2',
  'policy-holder-address-2',
  'policy-holder-address-as-patient-2',
  'policy-holder-city-2',
  'policy-holder-state-2',
  'policy-holder-zip-2',
  'patient-relationship-to-insured-2',
  'insurance-additional-information-2',
  'insurance-card-front-2',
  'insurance-card-back-2',
  'responsible-party-relationship',
  'responsible-party-first-name',
  'responsible-party-last-name',
  'responsible-party-birth-sex',
  'responsible-party-number',
  'photo-id-front',
  'photo-id-back',
  'hipaa-acknowledgement',
  'consent-to-treat',
  'signature',
  'full-name',
  'consent-form-signer-relationship',
] as const;
export type QRS_TELEMED_COMMON_FIELDS_TYPE = (typeof QRS_TELEMED_COMMON_FIELDS)[number];
export const ALL_TELEMED_PAPERWORK_FIELDS = [
  ...QRS_TELEMED_COMMON_FIELDS,
  'patient-point-of-discovery',
  'preferred-language',
  'relay-phone',
  'pcp-practice',
  'pcp-address',
  'current-medications-yes-no',
  'allergies-yes-no',
  'medical-history-yes-no',
  'surgical-history-yes-no',
  'covid-symptoms',
  'tested-positive-covid',
  'travel-usa',
  'credit-card-id',
  'policy-holder-date-of-birth',
  'policy-holder-date-of-birth-2',
  // QRS uses e.g. 'responsible-party-dob-day' etc, so must create
  'responsible-party-date-of-birth',
  'get-ready-for-the-visit-filling-out-as',
  'person-accompanying-minor-first-name',
  'person-accompanying-minor-last-name',
  'person-accompanying-minor-phone-number',
  'contacts-relationship-to-the-patient',
  'reason-for-visit',
  'additional-information',
  'patient-photos',
  'school-work-note-choice',
  'invite-from-another-device',
];
