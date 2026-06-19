// cSpell:ignore videoconference
import {
  Account,
  CodeableConcept,
  Coding,
  HealthcareService,
  Identifier,
  Location,
  Practitioner,
  PractitionerRole,
  Schedule,
} from 'fhir/r4b';
import type { AppointmentType, CanonicalUrl } from '../types';
import { ServiceMode, ServiceVisitType } from '../types/common';
import {
  DISCHARGE_SUMMARY_CODE,
  EXPORTED_QUESTIONNAIRE_CODE,
  INSURANCE_CARD_CODE,
  PATIENT_EDUCATION_DOC_TYPE_CODE,
  PATIENT_PHOTO_CODE,
  PHOTO_ID_CARD_CODE,
  PRIVACY_POLICY_CODE,
  RECEIPT_CODE,
  SCHOOL_WORK_NOTE_CODE,
  SCHOOL_WORK_NOTE_TEMPLATE_CODE,
  STATEMENT_CODE,
  VISIT_NOTE_SUMMARY_CODE,
} from '../types/data/paperwork/paperwork.constants';
import { ottehrCodeSystemUrl, ottehrExtensionUrl, ottehrIdentifierSystem } from './systemUrls';

// nota bene: some legacy resources could be using 'http' instead of 'https' here, and there are still some string vals out there with http
export const PRIVATE_EXTENSION_BASE_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions';
export const PUBLIC_EXTENSION_BASE_URL = 'https://extensions.fhir.zapehr.com';
export const FHIR_ZAPEHR_URL = 'https://fhir.zapehr.com';
const TERMINOLOGY_BASE_URL = 'http://terminology.hl7.org/CodeSystem';

export const SCHEDULE_EXTENSION_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule';
export const LOCATION_REVIEW_LINK_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/review-link`;
export const PROVIDER_TYPE_EXTENSION_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/provider-type';
const RCM_TERMINOLOGY_BASE_URL = 'https://terminology.zapehr.com/rcm/cms1500';

export const TIMEZONE_EXTENSION_URL = 'http://hl7.org/fhir/StructureDefinition/timezone';
export const ROOM_EXTENSION_URL = 'http://hl7.org/fhir/StructureDefinition/room';

export const FHIR_BASE_URL = 'https://fhir.ottehr.com';
export const OTTEHR_CODE_SYSTEM_BASE_URL = 'https://fhir.ottehr.com/CodeSystem';

export const FHIR_IDENTIFIER_NPI = 'http://hl7.org/fhir/sid/us-npi';
export const FHIR_IDENTIFIER_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0203';
export const FHIR_IDENTIFIER_CODE_TAX_EMPLOYER = 'NE';
export const FHIR_IDENTIFIER_CODE_TAX_SS = 'SS';
export const FHIR_IDENTIFIER_CODE_TAXONOMY = 'ZZ';
export const FRIENDLY_PATIENT_ID_SYSTEM_BASE = 'https://identifiers.fhir.oystehr.com/friendly-patient-id';
export const FHIR_AI_CHAT_CONSENT_CATEGORY_CODE = 'ai-chat';
export const FHIR_HL7_ORG_VALUE_SET_BASE_URL = 'http://hl7.org/fhir/ValueSet';

export const PARTICIPATION_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType';
export const ACCOUNT_TYPE_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/account-type';

export const FHIR_EXTENSION = {
  Appointment: {
    additionalInfo: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/additional-information`,
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
    attestedConsent: {
      url: `${PUBLIC_EXTENSION_BASE_URL}/encounter-attested-consent`,
    },
  },
  EncounterStatusHistory: {
    ottehrVisitStatus: {
      url: `${PUBLIC_EXTENSION_BASE_URL}/visit-status`,
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
    authorizedNonLegalGuardians: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/authorized-non-legal-guardians`,
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
    notes: {
      url: ottehrExtensionUrl('notes'),
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
  RelatedPerson: {
    responsiblePartyRelationship: {
      url: `${FHIR_HL7_ORG_VALUE_SET_BASE_URL}/relatedperson-relationshiptype`,
    },
  },
  Observation: {
    examComponentLabel: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/exam-component-label`,
    },
    examComponentGroupLabel: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/exam-component-group-label`,
    },
    examComponentColumnLabel: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/exam-component-column-label`,
    },
    examComponentAbnormal: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/exam-component-abnormal`,
    },
  },
} as const;

export type FHIR_EXTENSION_TYPE = typeof FHIR_EXTENSION;

export const PRACTITIONER_QUALIFICATION_EXTENSION_URL =
  'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification';

export const PRACTITIONER_QUALIFICATION_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0360|2.7';

export const PRACTITIONER_QUALIFICATION_STATE_SYSTEM = 'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state';

export const SLUG_SYSTEM = `${FHIR_BASE_URL}/r4/slug`;

// Slug values are interpolated raw into FHIR `identifier` search params as
// `${SLUG_SYSTEM}|${slug}` and into patient-facing booking URLs. Restrict to a
// URL-safe shape (letters/digits/hyphens) so a value saved in the admin UI
// can't fail validation when the patient side later searches by it.
export const SLUG_REGEX = /^[a-zA-Z0-9-]+$/;
export const SLUG_VALIDATION_MESSAGE = 'must be a URL-safe slug (letters, digits, hyphens)';
export const isValidSlug = (slug: string): boolean => SLUG_REGEX.test(slug);

/**
 * Optional admin-editable display name for a PractitionerRole-actored schedule.
 * Stored as a PR.extension valueString. When absent, callers compose a name
 * from the role's referenced Practitioner + Location — see the GroupPage /
 * PractitionerRoleList fallbacks. The field exists to disambiguate two PRs at
 * the same (provider, location) — e.g., a provider's morning intake schedule
 * vs afternoon surgery schedule.
 */
export const SCHEDULE_DISPLAY_NAME_EXTENSION_URL = `${FHIR_BASE_URL}/StructureDefinitions/schedule-display-name`;

/**
 * Per-PractitionerRole "offers every service category" toggle. When `true`,
 * the PR is treated as qualified for every service the slot generator asks
 * about — equivalent to the PR.healthcareService[] list containing every
 * service-category HealthcareService in the system (plus, by definition,
 * every BOOKING_CONFIG compiled-in category, which has no FHIR HS to
 * reference and is otherwise un-opt-into-able). Stored as a boolean PR
 * extension. Absent extension = false (admin opts in explicitly).
 *
 * The analogous group-side mechanism is `GROUP_ALL_LOCATIONS_SYSTEM`.
 */
export const PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL = `${FHIR_BASE_URL}/StructureDefinitions/practitioner-role-all-categories`;

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

export const APPOINTMENT_LOCKED_META_TAG_SYSTEM = 'appointment-locked-status';
export const APPOINTMENT_LOCKED_META_TAG = {
  system: APPOINTMENT_LOCKED_META_TAG_SYSTEM,
  code: 'APPOINTMENT_LOCKED',
};

export const FHIR_ENCOUNTER_ERX_PATIENT_SYNC_SYSTEM = 'encounter-erx-sync-status';
export const FHIR_ENCOUNTER_ERX_PATIENT_SYNC_CODE = 'ERX_PATIENT_SYNCED';
export const FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG = {
  system: FHIR_ENCOUNTER_ERX_PATIENT_SYNC_SYSTEM,
  code: FHIR_ENCOUNTER_ERX_PATIENT_SYNC_CODE,
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
  owner: Location | Practitioner | PractitionerRole | HealthcareService;
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

// ── HealthcareService characterization (service categories + groups) ─────────
//
// Constants below characterize HealthcareService resources used in the
// group-scheduling rework: service-category catalog entries (tagged with
// SERVICE_CATEGORY_TAG.meta) and group resources. Each `*_SYSTEM` is the
// code-system URL for one HealthcareService.characteristic dimension; the
// adjacent `*Coding` object provides typed shapes with `fullParam` ready for
// FHIR _filter queries.
//
// Note on parallel concepts: a separate ServiceModeCoding above uses the HL7
// standard system for location/practitioner mode tracking. ServiceCategory-
// ModeCoding here uses an ottehr-namespaced system derived from the product-
// level ServiceMode enum.

/** meta.tag identifying a HealthcareService as a service-category catalog entry. */
export const SERVICE_CATEGORY_TAG = {
  system: ottehrCodeSystemUrl('healthcare-service-type'),
  code: 'booking-service-category',
};

/** Code system for service-category codes (e.g. 'urgent-care', 'botox'). Used in HealthcareService.type[] codings. */
export const SERVICE_CATEGORY_SYSTEM = ottehrCodeSystemUrl('service-category');

/** Extension URL for the JSON-blob runtime config on service-category resources. */
export const SERVICE_CATEGORY_CONFIG_EXTENSION_URL = ottehrExtensionUrl('service-category-config');

// ── Service-category characteristic systems (one per dimension) ─────────────

/** Service-mode characteristic for a service-category HealthcareService. Codes match the ServiceMode enum. */
export const SERVICE_CATEGORY_MODE_SYSTEM = ottehrCodeSystemUrl('service-category-mode');
export const ServiceCategoryModeCoding = {
  inPerson: {
    system: SERVICE_CATEGORY_MODE_SYSTEM,
    code: ServiceMode['in-person'],
    display: 'In Person',
    fullParam: `${SERVICE_CATEGORY_MODE_SYSTEM}|${ServiceMode['in-person']}`,
  },
  virtual: {
    system: SERVICE_CATEGORY_MODE_SYSTEM,
    code: ServiceMode.virtual,
    display: 'Virtual',
    fullParam: `${SERVICE_CATEGORY_MODE_SYSTEM}|${ServiceMode.virtual}`,
  },
};

/** Visit-type-capability characteristic for a service-category HealthcareService. Codes match the ServiceVisitType enum. */
export const SERVICE_CATEGORY_VISIT_TYPE_SYSTEM = ottehrCodeSystemUrl('service-category-visit-type');
export const ServiceCategoryVisitTypeCoding = {
  prebook: {
    system: SERVICE_CATEGORY_VISIT_TYPE_SYSTEM,
    code: ServiceVisitType.prebook,
    display: 'Prebook',
    fullParam: `${SERVICE_CATEGORY_VISIT_TYPE_SYSTEM}|${ServiceVisitType.prebook}`,
  },
  walkIn: {
    system: SERVICE_CATEGORY_VISIT_TYPE_SYSTEM,
    code: ServiceVisitType['walk-in'],
    display: 'Walk-In',
    fullParam: `${SERVICE_CATEGORY_VISIT_TYPE_SYSTEM}|${ServiceVisitType['walk-in']}`,
  },
};

/**
 * Duration-minutes characteristic system for a service-category HealthcareService.
 * Values are runtime-configurable (admins set the minutes per service), so this
 * is a system constant only — call sites build the coding inline with
 * `{ system: SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM, code: String(minutes), display: '<n> min' }`.
 */
export const SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM = ottehrCodeSystemUrl('service-category-duration-minutes');

/**
 * Default slot duration in minutes when a service-category HealthcareService
 * doesn't carry a SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM characteristic.
 * Used as a soft fallback for legacy / partially-configured records. New
 * admin saves always set the field explicitly.
 */
export const DEFAULT_SERVICE_CATEGORY_DURATION_MINUTES = 15;

/** Cadence-minutes characteristic system for a service-category HealthcareService. Same call-site shape as duration-minutes. */
export const SERVICE_CATEGORY_CADENCE_MINUTES_SYSTEM = ottehrCodeSystemUrl('service-category-cadence-minutes');

// ── Group characteristic systems ────────────────────────────────────────────

/** Assignment-mode characteristic for a group HealthcareService: 'anonymous' (default) vs 'provider'. */
export const GROUP_ASSIGNMENT_MODE_SYSTEM = ottehrCodeSystemUrl('group-assignment-mode');
export const GroupAssignmentModeCoding = {
  anonymous: {
    system: GROUP_ASSIGNMENT_MODE_SYSTEM,
    code: 'anonymous',
    display: 'Anonymous',
    fullParam: `${GROUP_ASSIGNMENT_MODE_SYSTEM}|anonymous`,
  },
  provider: {
    system: GROUP_ASSIGNMENT_MODE_SYSTEM,
    code: 'provider',
    display: 'Provider',
    fullParam: `${GROUP_ASSIGNMENT_MODE_SYSTEM}|provider`,
  },
};

/**
 * All-locations characteristic for a group HealthcareService: 'true' | 'false'.
 * When 'true', the group pools from every active PractitionerRole in the
 * system (not constrained to the group's `.location[]` entries). Set on the
 * group admin form via a single toggle.
 */
export const GROUP_ALL_LOCATIONS_SYSTEM = ottehrCodeSystemUrl('group-all-locations');
export const GroupAllLocationsCoding = {
  true: {
    system: GROUP_ALL_LOCATIONS_SYSTEM,
    code: 'true',
    display: 'All locations',
    fullParam: `${GROUP_ALL_LOCATIONS_SYSTEM}|true`,
  },
  false: {
    system: GROUP_ALL_LOCATIONS_SYSTEM,
    code: 'false',
    display: 'Specific locations',
    fullParam: `${GROUP_ALL_LOCATIONS_SYSTEM}|false`,
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
  STATEMENTS: 'statements',
  PATIENT_EDUCATION: 'patient-education',
  PATIENT_EDUCATION_ADMIN: 'patient-education-admin',
  REPORTS: 'invoiceable-patients-reports',
  CUSTOM_FOLDERS: 'patient-docs-custom-folders',
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
    documentTypeCode: 'patient-registration', // PAPERWORK_CONSENT_CODE_UNIQUE.code
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
      '51991-8', // LAB_ORDER_DOC_REF_CODING_CODE.code - external lab ottehr generated order form and eReqs
      '11502-2', // LAB_RESULT_DOC_REF_CODING_CODE.code - lab results -- includes lab-generated and ottehr generated for external, as well as internal results
      'specimen-container-label', // EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE.code
      'external-lab-abn', // OYSTEHR_ABN_DOC_REF_CODING_UNIQUE.code
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
  {
    title: BUCKET_NAMES.STATEMENTS,
    display: 'Statements',
    documentTypeCode: STATEMENT_CODE,
  },
  {
    title: BUCKET_NAMES.PATIENT_EDUCATION,
    display: 'Patient Education',
    documentTypeCode: PATIENT_EDUCATION_DOC_TYPE_CODE,
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
      system: ACCOUNT_TYPE_CODE_SYSTEM,
      code: 'PBILLACCT',
      display: 'patient billing account',
    },
  ],
};

export const WORKERS_COMP_ACCOUNT_TYPE: Account['type'] = {
  coding: [
    {
      system: ACCOUNT_TYPE_CODE_SYSTEM,
      code: 'WCOMPACCT',
      display: 'worker compensation account',
    },
  ],
};

export const OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE: Account['type'] = {
  coding: [
    {
      system: ACCOUNT_TYPE_CODE_SYSTEM,
      code: 'OCCUPATIONALMEDICINEACCT',
      display: 'occupational medicine account',
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
  requiredBooleanValue: `${PRIVATE_EXTENSION_BASE_URL}/permissible-value`,
  // complex extensions
  answerLoadingOptions: {
    extension: `${PRIVATE_EXTENSION_BASE_URL}/answer-loading-options`,
    strategy: `${PRIVATE_EXTENSION_BASE_URL}/strategy`,
    source: `${PRIVATE_EXTENSION_BASE_URL}/source`,
    expression: `${PRIVATE_EXTENSION_BASE_URL}/expression`,
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
  answerDisplayFilter: {
    extension: `${PRIVATE_EXTENSION_BASE_URL}/answer-display-filter`,
    question: `${PRIVATE_EXTENSION_BASE_URL}/answer-display-filter-question`,
    operator: `${PRIVATE_EXTENSION_BASE_URL}/answer-display-filter-operator`,
    answer: `${PRIVATE_EXTENSION_BASE_URL}/answer-display-filter-answer`,
    include: `${PRIVATE_EXTENSION_BASE_URL}/answer-display-filter-include`,
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
export const ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT = 'https://api.stripe.com/v1/accounts';
export const SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/stripe-account-id';
/** @deprecated Use Device resource with STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM and STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE instead */
export const SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/advapacs-location-id';

// Device-based terminal location storage
export const STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM = 'https://api.stripe.com/v1/terminal/locations';
export const STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/device-type';
export const STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE = 'stripe-terminal-config';

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

export enum ServiceModeCategoryCode {
  virtualServiceMode = 'virtual-service-mode',
  inPersonServiceMode = 'in-person-service-mode',
}

export const SlotServiceCategory: { [key: string]: CodeableConcept } = {
  virtualServiceMode: {
    coding: [
      {
        system: `${FHIR_BASE_URL}/slot-service-category`,
        code: ServiceModeCategoryCode.virtualServiceMode,
      },
      // added to avoid confusion with new service category code system
      // can be removed in the future
      {
        system: `${OTTEHR_CODE_SYSTEM_BASE_URL}/service-mode-service-category`,
        code: ServiceModeCategoryCode.virtualServiceMode,
      },
    ],
  },
  inPersonServiceMode: {
    coding: [
      {
        system: `${FHIR_BASE_URL}/slot-service-category`,
        code: ServiceModeCategoryCode.inPersonServiceMode,
      },
      {
        system: `${OTTEHR_CODE_SYSTEM_BASE_URL}/service-mode-service-category`,
        code: ServiceModeCategoryCode.inPersonServiceMode,
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

// Extension recording the Location a Slot is being offered at. Stamped at
// slot-vending time so the Slot is self-describing — create-appointment
// reads this rather than re-resolving from the Schedule.actor graph (which
// is ambiguous for multi-location PractitionerRoles).
export const SLOT_AT_LOCATION_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/slot-at-location`;

export const makeSlotAtLocationExtensionEntry = (
  locationId: string
): { url: string; valueReference: { reference: string } } => {
  return {
    url: SLOT_AT_LOCATION_EXTENSION_URL,
    valueReference: { reference: `Location/${locationId}` },
  };
};

// Extension recording the group HealthcareService a Slot was booked through.
// Stamped at slot-vending time when the scheduleType is "group" — the
// Slot's Schedule.actor under pools-providers is the member PR, so
// without this extension a downstream consumer can't tell whether a
// PR-actored Slot was booked directly against that PR or through a group
// (which matters for assignment-mode interpretation, capacity-guard
// fallback eligibility, audit trails, etc.). Skipped when the Schedule's
// actor IS the group HS — the actor already records it; a redundant
// extension can only conflict.
export const SLOT_BOOKED_VIA_GROUP_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/slot-booked-via-group`;

export const makeSlotBookedViaGroupExtensionEntry = (
  groupHealthcareServiceId: string
): { url: string; valueReference: { reference: string } } => {
  return {
    url: SLOT_BOOKED_VIA_GROUP_EXTENSION_URL,
    valueReference: { reference: `HealthcareService/${groupHealthcareServiceId}` },
  };
};

// Meta tag stamped on a Slot when the create-appointment capacity-guard
// fallback rerouted it from its originally-targeted Schedule to a different
// member Schedule of the same anonymous-mode group. Bare boolean tag — purely
// a queryability handle ("how often does this happen, which Slots had it
// happen to them"). The original Schedule reference is recoverable from the
// Slot's FHIR _history if ever needed.
export const SLOT_FALLBACK_REROUTED_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/slot-fallback-rerouted`;
export const SLOT_FALLBACK_REROUTED_TAG = {
  system: SLOT_FALLBACK_REROUTED_TAG_SYSTEM,
  code: 'true',
};

// Extension for specifying which questionnaire should be used for appointments booked on this slot
export const SLOT_QUESTIONNAIRE_CANONICAL_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/slot-questionnaire-canonical`;

export const makeQuestionnaireCanonicalExtensionEntry = (
  canonical: CanonicalUrl
): { url: string; valueString: string } => {
  // Store as "url|version" format (standard FHIR canonical with version)
  const canonicalString = `${canonical.url}|${canonical.version}`;
  return {
    url: SLOT_QUESTIONNAIRE_CANONICAL_EXTENSION_URL,
    valueString: canonicalString,
  };
};

export const parseQuestionnaireCanonicalExtension = (valueString: string): CanonicalUrl => {
  const [url, version] = valueString.split('|');
  if (!version) {
    throw new Error(`Invalid questionnaire canonical extension value: "${valueString}" - missing version`);
  }
  return { url, version };
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

export const PREFERRED_PHARMACY_EXTENSION_URL = ottehrExtensionUrl('preferred-pharmacy');
export const PREFERRED_PHARMACY_MANUAL_ENTRY_URL = ottehrExtensionUrl('pharmacy-manual-entry'); // added when the pharmacy was added manually via text fields
export const PREFERRED_PHARMACY_PLACES_ID_URL = ottehrExtensionUrl('pharmacy-places-id'); // added when the pharmacy was selected with places search
// docs.oystehr.com/oystehr/services/erx/patient-sync/#preferred-pharmacy
export const PREFERRED_PHARMACY_ERX_ID_FOR_SYNC_URL =
  'https://extensions.fhir.oystehr.com/patient/erx-preferred-pharmacy-id';

export const ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL = ottehrExtensionUrl('payment-variant');

/** Employer Organization selected for this visit (staff / pre-op); not the patient Account occ-med employer. */
export const ENCOUNTER_VISIT_OCCUPATIONAL_MEDICINE_EMPLOYER_EXTENSION_URL = ottehrExtensionUrl(
  'visit-occupational-medicine-employer'
);

export const CONSENT_ATTESTATION_SIG_TYPE: Coding = Object.freeze({
  system: 'http://uri.etsi.org/01903/v1.2.2',
  code: 'ProofOfReceipt',
});

export const TASK_CATEGORY_IDENTIFIER = ottehrIdentifierSystem('task-category');
export const TASK_INPUT_SYSTEM = ottehrCodeSystemUrl('task-input');
export const TASK_LOCATION_SYSTEM = ottehrCodeSystemUrl('task-location');
export const TASK_ASSIGNED_DATE_TIME_EXTENSION_URL = ottehrExtensionUrl('task-assigned-date-time');

export const RCM_TASK_SYSTEM = ottehrCodeSystemUrl('rcm-task');
// note: be careful, one of these codes are hardcoded in zambdas config file in SUB-SEND-INVOICE-TO-PATIENT endpoint
export enum RcmTaskCode {
  sendInvoiceToPatient = 'send-invoice-to-patient',
  sendInvoiceOutputInvoiceId = 'send-invoice-output-invoice-Id',
  sendInvoiceOutputError = 'send-invoice-output-error',
}
export const RcmTaskCodings: { [key: string]: CodeableConcept } = {
  sendInvoiceToPatient: {
    coding: [
      {
        system: RCM_TASK_SYSTEM,
        code: RcmTaskCode.sendInvoiceToPatient,
      },
    ],
  },
  sendInvoiceOutputInvoiceId: {
    coding: [
      {
        system: RCM_TASK_SYSTEM,
        code: RcmTaskCode.sendInvoiceOutputInvoiceId,
      },
    ],
  },
  sendInvoiceOutputError: {
    coding: [
      {
        system: RCM_TASK_SYSTEM,
        code: RcmTaskCode.sendInvoiceOutputError,
      },
    ],
  },
};

export const DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO = 'Summary of visit from audio recording';
export const DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT = 'Summary of visit from chat';

export const EMPLOYER_ORG_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('organization-type');

export const ATTORNEY_FIRM_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/attorney-firm`;

export const GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/global-template-list`;
export const GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM = `${OTTEHR_CODE_SYSTEM_BASE_URL}/global-template-in-person`;

/** Builds the full meta.tag system URL from a chart data field name (e.g. 'chief-complaint' → full URL). */
export const chartDataTagSystem = (fieldName: string): string => `${PRIVATE_EXTENSION_BASE_URL}/${fieldName}`;

export const ICD_10_CODE_SYSTEM = 'http://hl7.org/fhir/sid/icd-10';

export const VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_TYPE = ottehrCodeSystemUrl('task-type');
export const VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE = 'video-chat-waiting-room-notification';

export const ACCIDENT_TYPE_SYSTEM = ottehrCodeSystemUrl('accident-type');
export const ACCIDENT_STATE_EXTENSION = ottehrExtensionUrl('accident-state');

export const PROVENANCE_FAX_SYSTEM = ottehrCodeSystemUrl('faxes');
export const PROVENANCE_FAX_ACTIVITY_CODES = {
  faxSent: 'fax-sent',
} as const;
export const PROVENANCE_FAX_ACTIVITY_DISPLAY = {
  faxSent: 'Fax Sent',
} as const;
export const FAX_SENT_PROVENANCE_ACTIVITY_CODING: Coding = {
  code: PROVENANCE_FAX_ACTIVITY_CODES.faxSent,
  display: PROVENANCE_FAX_ACTIVITY_DISPLAY.faxSent,
  system: PROVENANCE_FAX_SYSTEM,
};

export const EMPLOYEE_ID_SYSTEM = ottehrIdentifierSystem('employee-id');

export const CHARGE_MASTER_DESIGNATION_EXTENSION_URL = ottehrExtensionUrl('charge-master-designation');
export const RCM_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/rcm`;
export type ChargeMasterDesignation = 'default-insurance' | 'self-pay';
export type FeeScheduleDesignation = 'case-rate';
export const CASE_RATE_CODE = 'case-rate';

export const CPT_MODIFIER_EXTENSION_URL = ottehrExtensionUrl('cpt-modifier');
export const CPT_CODE_SYSTEM = 'http://www.ama-assn.org/go/cpt';

export const EXAM_MIGRATION_VERSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/exam-migration-version`;
// Version 1 and 2 are essentially the same
// The version was bumped to 2 to facilitate rendering a incompatibility message for old telemed charts
// Version 1 was only stamped on encounters where users clicked "migrate exam" however in order to differentiate between virtual visits pre and post exam config consolidation
// We need to record the current migration version on all encounters. There is an edge case were telemed exams were migrated and stamped with v1 before the 1.35 release
// but would actually be incompatible with the exam config going out in 1.35 (aka v2)
export const CURRENT_EXAM_MIGRATION_VERSION = 2;
export const INCOMPATIBLE_EXAM_VERSION_MESSAGE =
  "This chart's exam version is incompatible with the current exam configuration, please consult the visit PDF.";
