// cSpell:ignore videoconference
import { Account, CodeableConcept, HealthcareService, Identifier, Location, Practitioner, Schedule } from 'fhir/r4b';
import {
  AppointmentType,
  CONSENT_CODE,
  DISCHARGE_SUMMARY_CODE,
  EXPORTED_QUESTIONNAIRE_CODE,
  EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE,
  INSURANCE_CARD_CODE,
  LAB_ORDER_DOC_REF_CODING_CODE,
  LAB_RESULT_DOC_REF_CODING_CODE,
  PATIENT_PHOTO_CODE,
  PHOTO_ID_CARD_CODE,
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

export const SCHEDULE_EXTENSION_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule';

const RCM_TERMINOLOGY_BASE_URL = 'https://terminology.zapehr.com/rcm/cms1500';

export const TIMEZONE_EXTENSION_URL = 'http://hl7.org/fhir/StructureDefinition/timezone';
export const ROOM_EXTENSION_URL = 'http://hl7.org/fhir/StructureDefinition/room';

export const FHIR_BASE_URL = 'https://fhir.ottehr.com';

export const FHIR_IDENTIFIER_NPI = 'http://hl7.org/fhir/sid/us-npi';
export const FHIR_IDENTIFIER_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0203';
export const FHIR_IDENTIFIER_CODE_TAX_EMPLOYER = 'NE';
export const FHIR_IDENTIFIER_CODE_TAX_SS = 'SS';
export const FHIR_AI_CHAT_CONSENT_CATEGORY_CODE = 'ai-chat';

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
      // cSpell:disable-next claiminformationcategory
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
      // cSpell:disable-next allergyintolerance
      url: `${TERMINOLOGY_BASE_URL}/allergyintolerance-clinical`,
    },
  },
  Condition: {
    conditionClinical: {
      url: `${TERMINOLOGY_BASE_URL}/condition-clinical`,
    },
  },
  ServiceRequest: {
    medicationUsed: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/medication-used`,
    },
    bodySide: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/body-side`,
    },
    technique: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/technique`,
    },
    suppliesUsed: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/supplies-used`,
    },
    procedureDetails: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/procedure-details`,
    },
    specimenSent: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/specimen-sent`,
    },
    complications: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/complications`,
    },
    patientResponse: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/patient-response`,
    },
    postInstructions: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/post-instructions`,
    },
    timeSpent: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/time-spent`,
    },
    documentedBy: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/documented-by`,
    },
    consentObtained: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/consent-obtained`,
    },
  },
} as const;

export type FHIR_EXTENSION_TYPE = typeof FHIR_EXTENSION;

export const PRACTITIONER_QUALIFICATION_EXTENSION_URL =
  'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification';

export const PRACTITIONER_QUALIFICATION_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0360|2.7';

export const PRACTITIONER_QUALIFICATION_STATE_SYSTEM = 'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state';

export const SLUG_SYSTEM = `${FHIR_BASE_URL}/r4/slug`;

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

export const FHIR_APPOINTMENT_PREPROCESSING_STATUS_SYSTEM = 'appointment-preprocessing-status';

export const FHIR_APPOINTMENT_READY_FOR_PREPROCESSING_TAG = {
  system: FHIR_APPOINTMENT_PREPROCESSING_STATUS_SYSTEM,
  code: 'APPOINTMENT_READY_FOR_PREPROCESSING',
};

export const FHIR_APPOINTMENT_PREPROCESSED_TAG = {
  system: FHIR_APPOINTMENT_PREPROCESSING_STATUS_SYSTEM,
  code: 'APPOINTMENT_PREPROCESSED',
};

export const FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG = {
  system: 'appointment-harvesting-module-status',
  code: 'SUB_INTAKE_HARVEST_TASK_COMPLETE',
};

export const ERX_MEDICATION_META_TAG_CODE = 'erx-medication';

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
  videoConference: {
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

export interface ScheduleAndOwner {
  schedule: Schedule;
  owner: Location | Practitioner | HealthcareService;
}

interface BaseScheduleResponse {
  scheduleList: ScheduleAndOwner[];
}
interface ScheduleMetaData {
  type: 'location' | 'provider' | 'group';
  strategy?: ScheduleStrategy;
}
export interface BookableScheduleData extends BaseScheduleResponse {
  metadata: ScheduleMetaData;
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

export const BUCKET_NAMES = {
  VISIT_NOTES: 'visit-notes',
  CONSENT_FORMS: 'consent-forms',
  PRIVACY_POLICY: 'privacy-policy',
  INSURANCE_CARDS: 'insurance-cards',
  PHOTO_ID_CARDS: 'photo-id-cards',
  PATIENT_PHOTOS: 'patient-photos',
  SCHOOL_WORK_NOTES: 'school-work-notes',
  SCHOOL_WORK_NOTE_TEMPLATES: 'school-work-note-templates',
  LABS: 'labs',
  RECEIPTS: 'receipts',
  PAPERWORK: 'exported-questionnaires',
  DISCHARGE_SUMMARIES: 'discharge-summaries',
} as const;

export type BucketName = (typeof BUCKET_NAMES)[keyof typeof BUCKET_NAMES];
export interface ListConfig {
  title: string;
  display: string;
  documentTypeCode: string | string[];
}

export const FOLDERS_CONFIG: ListConfig[] = [
  {
    title: BUCKET_NAMES.VISIT_NOTES,
    display: 'Visit Notes',
    documentTypeCode: VISIT_NOTE_SUMMARY_CODE,
  },
  {
    title: BUCKET_NAMES.CONSENT_FORMS,
    display: 'Consent Forms',
    documentTypeCode: CONSENT_CODE,
  },
  {
    title: BUCKET_NAMES.PRIVACY_POLICY,
    display: 'Privacy Policy',
    documentTypeCode: PRIVACY_POLICY_CODE,
  },
  {
    title: BUCKET_NAMES.INSURANCE_CARDS,
    display: 'Insurance Cards',
    documentTypeCode: INSURANCE_CARD_CODE,
  },
  {
    title: BUCKET_NAMES.PHOTO_ID_CARDS,
    display: 'Photo ID',
    documentTypeCode: PHOTO_ID_CARD_CODE,
  },
  {
    title: BUCKET_NAMES.PATIENT_PHOTOS,
    display: 'Photos',
    documentTypeCode: PATIENT_PHOTO_CODE,
  },
  {
    title: BUCKET_NAMES.SCHOOL_WORK_NOTES,
    display: 'School/Work Notes',
    documentTypeCode: SCHOOL_WORK_NOTE_CODE,
  },
  {
    title: BUCKET_NAMES.SCHOOL_WORK_NOTE_TEMPLATES,
    display: 'School/Work Note templates',
    documentTypeCode: SCHOOL_WORK_NOTE_TEMPLATE_CODE,
  },
  {
    title: BUCKET_NAMES.LABS,
    display: 'Labs',
    documentTypeCode: [
      LAB_ORDER_DOC_REF_CODING_CODE.code,
      LAB_RESULT_DOC_REF_CODING_CODE.code,
      EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE.code,
    ],
  },
  {
    title: BUCKET_NAMES.RECEIPTS,
    display: 'Receipts',
    documentTypeCode: RECEIPT_CODE,
  },
  {
    title: BUCKET_NAMES.PAPERWORK,
    display: 'Paperwork',
    documentTypeCode: EXPORTED_QUESTIONNAIRE_CODE,
  },
  {
    title: BUCKET_NAMES.DISCHARGE_SUMMARIES,
    display: 'Discharge Summary',
    documentTypeCode: DISCHARGE_SUMMARY_CODE,
  },
];

export const SUBSCRIBER_RELATIONSHIP_CODE_MAP: Record<string, string> = {
  Child: 'child',
  Parent: 'parent',
  Spouse: 'spouse',
  'Common Law Spouse': 'common',
  Other: 'other',
  Self: 'self',
  'Injured Party': 'injured',
};

// this is required by US Core
// https://build.fhir.org/ig/HL7/US-Core/StructureDefinition-us-core-coverage-definitions.html#key_Coverage.identifier:memberid.type
export const COVERAGE_MEMBER_IDENTIFIER_BASE: Partial<Identifier> = {
  type: {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
        code: 'MB',
        display: 'Member Number',
      },
    ],
  },
};

export const PATIENT_BILLING_ACCOUNT_TYPE: Account['type'] = {
  coding: [
    {
      system: 'http://terminology.hl7.org/CodeSystem/account-type',
      code: 'PBILLACCT',
      display: 'patient billing account',
    },
  ],
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

// https://hl7.org/fhir/R4B/valueset-audit-event-outcome.html
export const AUDIT_EVENT_OUTCOME_CODE = {
  success: '0',
  minorFailure: '4',
  seriousFailure: '8',
  majorFailure: '12',
};

export const ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE = 'https://api.stripe.com/v1/customers';
export const WALKIN_APPOINTMENT_TYPE_CODE = 'WALKIN';
export const SLOT_WALKIN_APPOINTMENT_TYPE_CODING: CodeableConcept = {
  coding: [
    {
      system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
      code: WALKIN_APPOINTMENT_TYPE_CODE,
    },
  ],
};

export const FOLLOW_UP_APPOINTMENT_TYPE_CODE = 'FOLLOWUP';
export const SLOT_POST_TELEMED_APPOINTMENT_TYPE_CODING: CodeableConcept = {
  coding: [
    {
      system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
      code: 'FOLLOWUP',
    },
  ],
};

export enum SlotServiceCategoryCode {
  virtualServiceMode = 'virtual-service-mode',
  inPersonServiceMode = 'in-person-service-mode',
}

export const SlotServiceCategory: { [key: string]: CodeableConcept } = {
  virtualServiceMode: {
    coding: [
      {
        system: `${FHIR_BASE_URL}/slot-service-category`,
        code: SlotServiceCategoryCode.virtualServiceMode,
      },
    ],
  },
  inPersonServiceMode: {
    coding: [
      {
        system: `${FHIR_BASE_URL}/slot-service-category`,
        code: SlotServiceCategoryCode.inPersonServiceMode,
      },
    ],
  },
};

export const SLOT_BOOKING_FLOW_ORIGIN_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/slot-booking-flow-origin`;

export const makeBookingOriginExtensionEntry = (url: string): { url: string; valueString: string } => {
  return {
    url: SLOT_BOOKING_FLOW_ORIGIN_EXTENSION_URL,
    valueString: url,
  };
};

// this is the time in minutes after which a busy-tentative slot will be considered expired and will no longer
// be counted against the available slots. the _lastUpdated field will be checked, so mutating the slot
// at all will reset the timer
export const SLOT_BUSY_TENTATIVE_EXPIRATION_MINUTES = 10;
export const DEFAULT_APPOINTMENT_LENGTH_MINUTES = 15;

const PROCEDURES_TERMINOLOGY_BASE_URL = FHIR_BASE_URL + '/CodeSystem/Procedure';
export const PROCEDURE_TYPE_SYSTEM = PROCEDURES_TERMINOLOGY_BASE_URL + '/procedure-type';
export const PERFORMER_TYPE_SYSTEM = PROCEDURES_TERMINOLOGY_BASE_URL + '/performer-type';
export const BODY_SITE_SYSTEM = PROCEDURES_TERMINOLOGY_BASE_URL + '/body-site';

export const PAYMENT_METHOD_EXTENSION_URL = PUBLIC_EXTENSION_BASE_URL + '/payment-method';
