import {
  AppointmentType,
  CONSENT_CODE,
  INSURANCE_CARD_CODE,
  PATIENT_PHOTO_CODE,
  PHOTO_ID_CARD_CODE,
  PHOTON_PRACTITIONER_ENROLLED,
  PRIVACY_POLICY_CODE,
  RECEIPT_CODE,
  SCHOOL_WORK_NOTE_CODE,
  SCHOOL_WORK_NOTE_TEMPLATE_CODE,
  VISIT_NOTE_SUMMARY_CODE,
} from '../types';

// nota bene: some legacy resources could be using 'http' instead of 'https' here, and there are still some string vals out there with http
export const PRIVATE_EXTENSION_BASE_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions';
export const PUBLIC_EXTENSION_BASE_URL = 'https://extensions.fhir.zapehr.com';
export const FHIR_ZAPEHR_URL = 'https://fhir.zapehr.com';
const TERMINOLOGY_BASE_URL = 'http://terminology.hl7.org/CodeSystem';

const RCM_TERMINOLOGY_BASE_URL = 'https://terminology.zapehr.com/rcm/cms1500';

export const TIMEZONE_EXTENSION_URL = 'http://hl7.org/fhir/StructureDefinition/timezone';

export const OTTEHR_BASE_URL = 'https://fhir.ottehr.com';

export const FHIR_IDENTIFIER_NPI = 'http://hl7.org/fhir/sid/us-npi';
export const FHIR_IDENTIFIER_SYSTEM_TAX = 'http://terminology.hl7.org/CodeSystem/v2-0203';
export const FHIR_IDENTIFIER_CODE_TAX_EMPLOYER = 'NE';
export const FHIR_IDENTIFIER_CODE_TAX_SS = 'SS';

export const FHIR_EXTENSION = {
  Appointment: {
    additionalInfo: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/additional-information`,
    },
    unconfirmedDateOfBirth: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/date-of-birth-not-confirmed`,
    },
    bookedBy: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/visit-booked-by`,
    },
  },
  Encounter: {
    otherParticipants: {
      url: `${PUBLIC_EXTENSION_BASE_URL}/encounter-other-participants`,
      extension: {
        otherParticipant: {
          url: `${PUBLIC_EXTENSION_BASE_URL}/encounter-other-participant`,
        },
      },
    },
  },
  Location: {
    locationFormPreRelease: {
      url: `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`,
    },
  },
  Patient: {
    weight: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/weight`,
    },
    weightLastUpdated: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/weight-last-updated`,
    },
    chosenName: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/chosen-name`,
    },
  },
  Paperwork: {
    formListValues: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/form-list-values`,
      extension: {
        formListValue: {
          url: `${PRIVATE_EXTENSION_BASE_URL}/form-list-value`,
        },
      },
    },
    legalTimezone: {
      url: `${PUBLIC_EXTENSION_BASE_URL}/legal-timezone`,
    },
    submitterIP: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/ip-address`,
    },
  },
  ContactPoint: {
    erxTelecom: {
      url: 'https://extensions.fhir.oystehr.com/contact-point/telecom-phone-erx',
    },
  },
  Practitioner: {
    isEnrolledInPhoton: {
      url: PHOTON_PRACTITIONER_ENROLLED,
    },
  },

  InsurancePlan: {
    insuranceRequirements: {
      url: `${PUBLIC_EXTENSION_BASE_URL}/insurance-requirements`,
    },
  },
  QuestionnaireResponse: {
    ipAddress: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/ip-address`,
    },
  },
  Coverage: {
    subscriberRelationship: {
      url: `${TERMINOLOGY_BASE_URL}/subscriber-relationship`,
    },
    coverageClass: {
      url: `${TERMINOLOGY_BASE_URL}/coverage-class`,
    },
  },
  Organization: {
    v2_0203: {
      url: `${TERMINOLOGY_BASE_URL}/v2-0203`,
    },
    organizationType: {
      url: `${TERMINOLOGY_BASE_URL}/organization-type`,
    },
  },
  Claim: {
    v3_ActCode: {
      url: `${TERMINOLOGY_BASE_URL}/v3-ActCode`,
    },
    claimConditionCode: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/claim-condition-code`,
    },
    claimInformationCategory: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/claiminformationcategory`,
    },
    resubmissionRelationship: {
      url: `${RCM_TERMINOLOGY_BASE_URL}/resubmission-relationship`,
    },
    claimDiagnosesComment: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/claim-diagnoses-comment`,
    },
    revenueCode: {
      url: `${RCM_TERMINOLOGY_BASE_URL}/revenue-code`,
    },
    procedureModifier: {
      url: `${RCM_TERMINOLOGY_BASE_URL}/procedure-modifier`,
    },
    patientPaid: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/patient-paid`,
    },
  },
  AllergyIntolerance: {
    allergyIntoleranceClinical: {
      url: `${TERMINOLOGY_BASE_URL}/allergyintolerance-clinical`,
    },
  },
  Condition: {
    conditionClinical: {
      url: `${TERMINOLOGY_BASE_URL}/condition-clinical`,
    },
  },
} as const;

export type FHIR_EXTENSION_TYPE = typeof FHIR_EXTENSION;

export const PRACTITIONER_QUALIFICATION_EXTENSION_URL =
  'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification';

export const PRACTITIONER_QUALIFICATION_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0360|2.7';

export const PRACTITIONER_QUALIFICATION_STATE_SYSTEM = 'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state';

export const SLUG_SYSTEM = `${OTTEHR_BASE_URL}/r4/slug`;

export const SERVICE_EXTENSION = 'http://extensions.ottehr.com';

export const AppointmentInsuranceRelatedResourcesExtension = {
  extensionUrl: `${SERVICE_EXTENSION}/insurance-related-resources`,
  primaryCoverage: {
    coverage: { url: `${SERVICE_EXTENSION}/coverage-reference` },
    eligibilityRequest: { url: `${SERVICE_EXTENSION}/coverage-eligibility-request-reference` },
    eligibilityResponse: { url: `${SERVICE_EXTENSION}/coverage-eligibility-response-reference` },
  },
  secondaryCoverage: {
    coverage: { url: `${SERVICE_EXTENSION}/secondary-coverage-reference` },
    eligibilityRequest: { url: `${SERVICE_EXTENSION}/secondary-coverage-eligibility-request-reference` },
    eligibilityResponse: { url: `${SERVICE_EXTENSION}/secondary-coverage-eligibility-response-reference` },
  },
};

export const FHIR_APPOINTMENT_TYPE_MAP: Record<string, AppointmentType> = {
  walkin: 'walk-in',
  prebook: 'pre-booked',
  posttelemed: 'post-telemed',
};

export const SERVICE_MODE_SYSTEM = 'http://hl7.org/fhir/service-mode';
export const SCHEDULE_STRATEGY_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/healthcare-service-schedule-strategy`;

export const ServiceModeCoding = {
  inPerson: {
    system: SERVICE_MODE_SYSTEM,
    code: 'in-person',
    display: 'In Person',
    fullParam: `${SERVICE_MODE_SYSTEM}|in-person`,
  },
  telephone: {
    system: SERVICE_MODE_SYSTEM,
    code: 'telephone',
    display: 'Telephone',
    fullParam: `${SERVICE_MODE_SYSTEM}|telephone`,
  },
  videoconference: {
    system: SERVICE_MODE_SYSTEM,
    code: 'videoconference',
    display: 'Video Conference',
    fullParam: `${SERVICE_MODE_SYSTEM}|videoconference`,
  },
  chat: {
    system: SERVICE_MODE_SYSTEM,
    code: 'chat',
    display: 'Chat/Messaging',
    fullParam: `${SERVICE_MODE_SYSTEM}|chat`,
  },
};

export const SCHEDULE_NUM_DAYS = 2;

export enum ScheduleStrategy {
  owns = 'owns',
  poolsLocations = 'pools-locations',
  poolsProviders = 'pools-providers',
  poolsAll = 'pools-all',
}

export const ScheduleStrategyCoding = {
  owns: {
    system: SCHEDULE_STRATEGY_SYSTEM,
    code: 'owns',
    display: 'Owns',
    fullParam: `${SCHEDULE_STRATEGY_SYSTEM}|owns`,
  },
  poolsLocations: {
    system: SCHEDULE_STRATEGY_SYSTEM,
    code: 'pools-locations',
    display: 'Pools Locations',
    fullParam: `${SCHEDULE_STRATEGY_SYSTEM}|pools-locations`,
  },
  poolsProviders: {
    system: SCHEDULE_STRATEGY_SYSTEM,
    code: 'pools-providers',
    display: 'Pools Providers',
    fullParam: `${SCHEDULE_STRATEGY_SYSTEM}|pools-providers`,
  },
  poolsAll: {
    system: SCHEDULE_STRATEGY_SYSTEM,
    code: 'pools-all',
    display: 'Pools All',
    fullParam: `${SCHEDULE_STRATEGY_SYSTEM}|pools-all`,
  },
};

interface ListConfig {
  title: string;
  display: string;
  documentTypeCode: string | string[];
}

export const FOLDERS_CONFIG: ListConfig[] = [
  {
    title: 'visit-notes',
    display: 'Visit Notes',
    documentTypeCode: VISIT_NOTE_SUMMARY_CODE,
  },
  {
    title: 'consent-forms',
    display: 'Consent Forms',
    documentTypeCode: CONSENT_CODE,
  },
  {
    title: 'privacy-policy',
    display: 'Privacy Policy',
    documentTypeCode: PRIVACY_POLICY_CODE,
  },
  {
    title: 'insurance-cards',
    display: 'Ins Cards / Photo ID',
    documentTypeCode: [INSURANCE_CARD_CODE, PHOTO_ID_CARD_CODE],
  },
  {
    title: 'patient-photos',
    display: 'Photos',
    documentTypeCode: PATIENT_PHOTO_CODE,
  },
  {
    title: 'school-work-note-templates',
    display: 'School/Work Notes',
    documentTypeCode: [SCHOOL_WORK_NOTE_TEMPLATE_CODE, SCHOOL_WORK_NOTE_CODE],
  },
  {
    title: 'receipts',
    display: 'Receipts',
    documentTypeCode: RECEIPT_CODE,
  },
];

export const SUBSCRIBER_RELATIONSHIP_CODE_MAP: Record<string, string> = {
  Child: 'child',
  Parent: 'parent',
  Spouse: 'spouse',
  Other: 'other',
  Self: 'self',
};

export const OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS = {
  acceptsMultipleAnswers: `${PRIVATE_EXTENSION_BASE_URL}/accepts-multiple-answers`,
  alwaysFilter: `${PRIVATE_EXTENSION_BASE_URL}/always-filter`,
  attachmentText: `${PRIVATE_EXTENSION_BASE_URL}/attachment-text`,
  autofillFromWhenDisabled: `${PRIVATE_EXTENSION_BASE_URL}/fill-from-when-disabled`,
  categoryTag: `${PRIVATE_EXTENSION_BASE_URL}/category-tag`,
  dataType: `${PRIVATE_EXTENSION_BASE_URL}/data-type`,
  disabledDisplay: `${PRIVATE_EXTENSION_BASE_URL}/disabled-display`,
  groupType: `${PRIVATE_EXTENSION_BASE_URL}/group-type`,
  infoText: `${PRIVATE_EXTENSION_BASE_URL}/information-text`,
  inputWidth: `${PRIVATE_EXTENSION_BASE_URL}/input-width`,
  minRows: `${PRIVATE_EXTENSION_BASE_URL}/text-min-rows`,
  preferredElement: `${PRIVATE_EXTENSION_BASE_URL}/preferred-element`,
  secondaryInfoText: `${PRIVATE_EXTENSION_BASE_URL}/information-text-secondary`,
  validateAgeOver: `${PRIVATE_EXTENSION_BASE_URL}/validate-age-over`,
  // complex extensions
  answerLoadingOptions: {
    extension: `${PRIVATE_EXTENSION_BASE_URL}/answer-loading-options`,
    strategy: `${PRIVATE_EXTENSION_BASE_URL}/strategy`,
    source: `${PRIVATE_EXTENSION_BASE_URL}/source`,
  },
  complexValidation: {
    extension: `${PRIVATE_EXTENSION_BASE_URL}/complex-validation`,
    type: `${PRIVATE_EXTENSION_BASE_URL}/complex-validation-type`,
    triggerWhen: {
      extension: `${PRIVATE_EXTENSION_BASE_URL}/complex-validation-triggerWhen`,
      question: `${PRIVATE_EXTENSION_BASE_URL}/complex-validation-triggerQuestion`,
      operator: `${PRIVATE_EXTENSION_BASE_URL}/complex-validation-triggerOperator`,
      answer: `${PRIVATE_EXTENSION_BASE_URL}/complex-validation-triggerAnswer`,
    },
  },
  filterWhen: {
    extension: `${PRIVATE_EXTENSION_BASE_URL}/filter-when`,
    question: `${PRIVATE_EXTENSION_BASE_URL}/filter-when-question`,
    operator: `${PRIVATE_EXTENSION_BASE_URL}/filter-when-operator`,
    answer: `${PRIVATE_EXTENSION_BASE_URL}/filter-when-answer`,
  },
  requireWhen: {
    extension: `${PRIVATE_EXTENSION_BASE_URL}/require-when`,
    question: `${PRIVATE_EXTENSION_BASE_URL}/require-when-question`,
    operator: `${PRIVATE_EXTENSION_BASE_URL}/require-when-operator`,
    answer: `${PRIVATE_EXTENSION_BASE_URL}/require-when-answer`,
  },
  textWhen: {
    extension: `${PRIVATE_EXTENSION_BASE_URL}/text-when`,
    question: `${PRIVATE_EXTENSION_BASE_URL}/text-when-question`,
    operator: `${PRIVATE_EXTENSION_BASE_URL}/text-when-operator`,
    answer: `${PRIVATE_EXTENSION_BASE_URL}/text-when-answer`,
    substituteText: `${PRIVATE_EXTENSION_BASE_URL}/text-when-substitute-text`,
  },
};
