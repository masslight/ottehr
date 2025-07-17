export const TELEMED_VIDEO_ROOM_CODE = 'chime-video-meetings';

export const INTERPRETER_PHONE_NUMBER = '(888) 555 0002';

export const PROJECT_NAME = 'Ottehr';
export const PROJECT_NAME_LOWER = PROJECT_NAME.toLowerCase();
export const PROJECT_DOMAIN = 'ottehr.com';
export const PROJECT_WEBSITE = `https://${PROJECT_DOMAIN}`;
export const SUPPORT_EMAIL = 'support@ottehr.com';

export const PATIENT_INDIVIDUAL_PRONOUNS_URL = 'http://hl7.org/fhir/StructureDefinition/individual-pronouns';
export const PATIENT_INDIVIDUAL_PRONOUNS_CUSTOM_URL =
  'https://fhir.zapehr.com/r4/StructureDefinitions/individual-pronouns-custom';
export const PATIENT_FILLING_OUT_AS_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/form-user';
export const PATIENT_RACE_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/race';
export const PATIENT_ETHNICITY_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/ethnicity';
export const PATIENT_SEXUAL_ORIENTATION_URL =
  'http://hl7.org/fhir/us/cdmh/StructureDefinition/cdmh-patient-sexualOrientation';
export const PATIENT_POINT_OF_DISCOVERY_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/point-of-discovery';
export const PATIENT_SEND_MARKETING_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/send-marketing';
export const PATIENT_HEARING_IMPAIRED_RELAY_SERVICE_URL =
  'https://fhir.zapehr.com/r4/StructureDefinitions/hearing-impaired-relay-service';
export const PATIENT_COMMON_WELL_CONSENT_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/common-well-consent';
export const PATIENT_GENDER_IDENTITY_URL = 'http://hl7.org/fhir/StructureDefinition/individual-genderIdentity';
export const PATIENT_GENDER_IDENTITY_DETAILS_URL =
  'https://fhir.zapehr.com/r4/StructureDefinitions/individual-genderIdentity';
export const PATIENT_RELEASE_OF_INFO_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/release-of-info';
export const PATIENT_RX_HISTORY_CONSENT_STATUS_URL =
  'https://fhir.zapehr.com/r4/StructureDefinitions/rx-history-consent-status';
export const PATIENT_DECEASED_NOTE_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/deceased-note';
export const COVERAGE_ADDITIONAL_INFORMATION_URL =
  'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information';
export const RELATED_PERSON_SAME_AS_PATIENT_ADDRESS_URL =
  'https://fhir.zapehr.com/r4/StructureDefinitions/related-person-same-as-patient-address';
export const PRACTICE_NAME_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/practice-name';
export const DATE_OF_BIRTH_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/birth-date';

export const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];

export const E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM = 'E2E_TEST_RESOURCE_PROCESS_ID';

export const MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM =
  'https://terminology.fhir.oystehr.com/CodeSystem/medispan-dispensable-drug-id';

export const INSURANCE_REQ_EXTENSION_URL = 'https://extensions.fhir.zapehr.com/insurance-requirements';
export const ORG_TYPE_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/organization-type';
// currently all orgs are payers. if we ever have a need to store a parent company (Aetna, rather than Aetna, New York, for instance)
// we'll use the INSURANCE_ORG_TYPE_INSURANCE_COMPANY type on the parent org
// export const INSURANCE_ORG_TYPE_INSURANCE_COMPANY = 'ins';
export const ORG_TYPE_PAYER_CODE = 'pay';
