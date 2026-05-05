import {
  type FormFieldSection,
  type FormFieldTrigger,
  HomepageOptions,
  type QuestionnaireBase,
  type QuestionnaireConfigType,
  type ServiceCategoryConfig,
} from 'config-types';
import { Coding, Questionnaire, Slot } from 'fhir/r4b';
import z from 'zod';
import {
  CONFIG_INJECTION_KEYS,
  createProxyConfigObject,
  mergeAndFreezeConfigObjects,
} from '../../config-helpers/helpers';
import {
  buildReasonForVisitFromConfig,
  createQuestionnaireFromConfig,
} from '../../config-helpers/shared-questionnaire';
import { SERVICE_CATEGORY_SYSTEM } from '../../fhir';
import { CanonicalUrl } from '../../types';
import { BRANDING_CONFIG } from '../branding';
import { buildBookingScreeningItemsAvoiding } from '../screening-questions';
import { VALUE_SETS } from '../value-sets';

// --- Data inlined from defaults.ts ---

export interface StrongCoding extends Coding {
  code: string;
  display: string;
  system: string;
}

export interface BookingOption {
  id: string;
  label: string;
}

const PatientDoesntExistTriggerEnableAndRequire: FormFieldTrigger = {
  targetQuestionLinkId: 'existing-patient-id',
  effect: ['enable', 'require'],
  operator: 'exists',
  answerBoolean: false,
};

const PatientDoesntExistTriggerEnableOnly: FormFieldTrigger = {
  targetQuestionLinkId: 'existing-patient-id',
  effect: ['enable'],
  operator: 'exists',
  answerBoolean: false,
};

export const SERVICE_CATEGORIES_AVAILABLE: ServiceCategoryConfig[] = [
  {
    category: { display: 'Urgent Care', code: 'urgent-care', system: SERVICE_CATEGORY_SYSTEM },
    serviceModes: ['in-person', 'virtual'],
    visitTypes: ['prebook', 'walk-in'],
    reasonsForVisit: {
      default: [
        { label: 'Cough and/or congestion', value: 'Cough and/or congestion' },
        { label: 'Throat pain', value: 'Throat pain' },
        { label: 'Eye concern', value: 'Eye concern' },
        { label: 'Fever', value: 'Fever' },
        { label: 'Ear pain', value: 'Ear pain' },
        { label: 'Vomiting and/or diarrhea', value: 'Vomiting and/or diarrhea' },
        { label: 'Abdominal (belly) pain', value: 'Abdominal (belly) pain' },
        { label: 'Rash or skin issue', value: 'Rash or skin issue' },
        { label: 'Urinary problem', value: 'Urinary problem' },
        { label: 'Breathing problem', value: 'Breathing problem' },
        { label: 'Injury to arm', value: 'Injury to arm' },
        { label: 'Injury to leg', value: 'Injury to leg' },
        { label: 'Injury to head', value: 'Injury to head' },
        { label: 'Injury (Other)', value: 'Injury (Other)' },
        { label: 'Cut to arm or leg', value: 'Cut to arm or leg' },
        { label: 'Cut to face or head', value: 'Cut to face or head' },
        { label: 'Removal of sutures/stitches/staples', value: 'Removal of sutures/stitches/staples' },
        { label: 'Choked or swallowed something', value: 'Choked or swallowed something' },
        { label: 'Allergic reaction to medication or food', value: 'Allergic reaction to medication or food' },
        { label: 'Auto accident', value: 'Auto accident' },
        { label: 'Other', value: 'Other' },
      ],
    },
  },
  {
    category: { display: 'Occupational Medicine', code: 'occupational-medicine', system: SERVICE_CATEGORY_SYSTEM },
    serviceModes: ['in-person', 'virtual'],
    visitTypes: ['prebook', 'walk-in'],
    reasonsForVisit: {
      default: [
        { label: 'Injury', value: 'Injury' },
        { label: 'Testing', value: 'Testing' },
        { label: 'Physical', value: 'Physical' },
      ],
    },
  },
  {
    category: { display: 'Workers Comp', code: 'workers-comp', system: SERVICE_CATEGORY_SYSTEM },
    serviceModes: ['in-person', 'virtual'],
    visitTypes: ['prebook', 'walk-in'],
    reasonsForVisit: {
      default: [
        { label: 'New injury', value: 'New injury' },
        { label: 'Follow-up', value: 'Follow-up' },
      ],
    },
  },
];

const getFormFields = (
  serviceCategories: ServiceCategoryConfig[] = SERVICE_CATEGORIES_AVAILABLE
): Record<string, FormFieldSection> => {
  const hiddenFields: string[] = [];
  const requiredFields: string[] = ['patient-birth-sex', 'patient-email'];
  const { reasonForVisit, isHidden } = buildReasonForVisitFromConfig(serviceCategories);
  if (isHidden) {
    hiddenFields.push(reasonForVisit.key);
  } else {
    requiredFields.push(reasonForVisit.key);
  }
  return {
    patientInfo: {
      linkId: 'patient-information-page',
      title: 'About the patient',
      logicalItems: {
        shouldDisplaySsnField: {
          key: 'should-display-ssn-field',
          type: 'boolean',
          initialValue: false,
        },
        ssnFieldRequired: {
          key: 'ssn-field-required',
          type: 'boolean',
        },
        existingPatientId: {
          key: 'existing-patient-id',
          type: 'string',
        },
        appointmentServiceCategory: {
          key: 'appointment-service-category',
          type: 'string',
        },
        appointmentServiceMode: {
          key: 'appointment-service-mode',
          type: 'string',
        },
      },
      items: {
        firstName: {
          key: 'patient-first-name',
          label: 'First name (legal)',
          type: 'string',
          disabledDisplay: 'hidden',
          triggers: [PatientDoesntExistTriggerEnableAndRequire],
        },
        middleName: {
          key: 'patient-middle-name',
          label: 'Middle name (legal)',
          type: 'string',
          disabledDisplay: 'hidden',
          triggers: [PatientDoesntExistTriggerEnableOnly],
        },
        lastName: {
          key: 'patient-last-name',
          label: 'Last name (legal)',
          type: 'string',
          disabledDisplay: 'hidden',
          triggers: [PatientDoesntExistTriggerEnableAndRequire],
        },
        preferredName: {
          key: 'patient-preferred-name',
          label: 'Chosen or preferred name (optional)',
          type: 'string',
        },
        dateOfBirth: {
          key: 'patient-birthdate',
          label: 'Date of birth',
          type: 'date',
          dataType: 'DOB',
          triggers: [PatientDoesntExistTriggerEnableAndRequire],
        },
        birthSex: {
          key: 'patient-birth-sex',
          label: 'Birth sex',
          type: 'choice',
          options: VALUE_SETS.birthSexOptions,
        },
        weight: {
          key: 'patient-weight',
          label: 'Weight (lbs)',
          type: 'decimal',
          triggers: [
            {
              targetQuestionLinkId: 'appointment-service-mode',
              effect: ['enable'],
              operator: '=',
              answerString: 'virtual',
            },
          ],
          disabledDisplay: 'hidden',
        },
        ssn: {
          key: 'patient-ssn',
          label: 'SSN',
          type: 'string',
          dataType: 'SSN',
          disabledDisplay: 'hidden',
          triggers: [
            {
              targetQuestionLinkId: 'should-display-ssn-field',
              effect: ['enable'],
              operator: '=',
              answerBoolean: true,
            },
            {
              targetQuestionLinkId: 'ssn-field-required',
              effect: ['require'],
              operator: '=',
              answerBoolean: true,
            },
          ],
        },
        email: {
          key: 'patient-email',
          label: 'Email',
          type: 'string',
          dataType: 'Email',
        },
        returnPatientCheck: {
          key: 'return-patient-check',
          label: `Have you been to ${BRANDING_CONFIG.projectName} in the past 3 years?`,
          type: 'choice',
          disabledDisplay: 'hidden',
          options: VALUE_SETS.yesNoOptions,
          triggers: [PatientDoesntExistTriggerEnableAndRequire],
        },
        // Single RFV field with display filters, auto-generated from service category config
        reasonForVisit,
        tellUsMore: {
          key: 'tell-us-more',
          label: 'Tell us more',
          type: 'string',
          triggers: [
            {
              targetQuestionLinkId: 'reason-for-visit',
              effect: ['require'],
              operator: '=',
              answerString: 'Other',
            },
          ],
          enableBehavior: 'any',
        },
        authorizedNonLegalGuardians: {
          key: 'authorized-non-legal-guardian',
          label: 'Who, besides the parent or legal guardian, is allowed to bring in the patient?',
          type: 'string',
        },
      },
      hiddenFields,
      requiredFields,
    },
  };
};

const hiddenFormSections: string[] = [];

const questionnaireBaseDefaults: QuestionnaireBase = {
  resourceType: 'Questionnaire',
  url: 'https://ottehr.com/FHIR/Questionnaire/book-appointment',
  version: '1.0.0',
  name: 'BookAppointmentQuestionnaire',
  title: 'Book Appointment Form',
  status: 'active',
};

const getFormDefaults = (serviceCategories?: ServiceCategoryConfig[]): QuestionnaireConfigType => ({
  questionnaireBase: questionnaireBaseDefaults,
  hiddenFormSections,
  FormFields: getFormFields(serviceCategories),
});

export const inPersonPrebookRoutingParams: { key: string; value: string }[] = [
  { key: 'bookingOn', value: 'visit-followup-group' },
  { key: 'scheduleType', value: 'group' },
];

enum VisitType {
  InPersonWalkIn = 'in-person-walk-in',
  InPersonPreBook = 'in-person-pre-booked',
  InPersonPostTelemed = 'in-person-post-telemed',
  VirtualOnDemand = 'virtual-on-demand',
  VirtualScheduled = 'virtual-scheduled',
}

const BOOKING_DEFAULTS_DATA = {
  homepageOptions: [
    { id: HomepageOptions.StartInPersonVisit, label: 'In-Person Check-In' },
    { id: HomepageOptions.ScheduleInPersonVisit, label: 'Schedule In-Person Visit' },
    { id: HomepageOptions.StartVirtualVisit, label: 'Start Virtual Visit' },
    { id: HomepageOptions.ScheduleVirtualVisit, label: 'Schedule Virtual Visit' },
  ] as BookingOption[],
  defaultWalkinLocationName: 'New_York',
  ehrBookingOptions: [
    {
      id: VisitType.InPersonWalkIn,
      label: 'Walk-in In Person Visit',
    },
    {
      id: VisitType.InPersonPreBook,
      label: 'Pre-booked In Person Visit',
    },
    {
      id: VisitType.VirtualOnDemand,
      label: 'On Demand Virtual Visit',
    },
    {
      id: VisitType.VirtualScheduled,
      label: 'Scheduled Virtual Visit',
    },
    {
      id: VisitType.InPersonPostTelemed,
      label: 'Post Telemed Lab Only',
    },
  ] as BookingOption[],
  serviceCategories: SERVICE_CATEGORIES_AVAILABLE,
  inPersonPrebookRoutingParams,
};

// --- End inlined data ---

const BOOKING_QUESTIONNAIRE = (): Questionnaire =>
  JSON.parse(JSON.stringify(createQuestionnaireFromConfig(getFormDefaults())));

export const selectBookingQuestionnaire: (_slot?: Slot) => {
  url: string;
  version: string;
  templateQuestionnaire: Questionnaire;
} = (_slot?: Slot): { url: string; version: string; templateQuestionnaire: Questionnaire } => {
  // can read properties of slot to determine which questionnaire to return
  // if desired. by default, we return just a single questionnaire regardless of slot
  const Q = BOOKING_QUESTIONNAIRE();
  if (!Q.url || !Q.version) {
    throw new Error('Booking questionnaire is missing url or version');
  }
  return { url: Q.url, version: Q.version, templateQuestionnaire: Q };
};

export interface BookingConfig {
  homepageOptions: BookingOption[];
  ehrBookingOptions: BookingOption[];
  serviceCategories: ServiceCategoryConfig[];
  formConfig: QuestionnaireConfigType;
  inPersonPrebookRoutingParams: { key: string; value: string }[];
  defaultWalkinLocationName?: string;
  // Questionnaire-related fields used for building the form
  FormFields?: Record<string, unknown>;
  questionnaireBase?: QuestionnaireBase;
  hiddenFormSections?: string[];
  // Optional questionnaire canonical URLs for slot creation
  // When set, these are passed to create-slot and stored on the Slot extension
  // Used by e2e tests to inject isolated test questionnaires
  virtualQuestionnaireCanonical?: CanonicalUrl;
  inPersonQuestionnaireCanonical?: CanonicalUrl;
}

// Apply the screening overlay to a freshly-built formConfig. Auto-generated
// screening questions for the in-person flow are merged in here (rather than
// spliced into the booking form's source config) so customer config branches
// that override `formConfig` don't have to mirror the screening logic.
// Idempotent: a manual entry already present in `patientInfo.items` (matched
// by `key`) is left untouched.
const applyScreeningOverlayToFormConfig = (formConfig: QuestionnaireConfigType): QuestionnaireConfigType => {
  const existingItems = (formConfig.FormFields as Record<string, any>).patientInfo?.items ?? {};
  const additions = buildBookingScreeningItemsAvoiding(existingItems);
  if (Object.keys(additions).length === 0) return formConfig;

  return {
    ...formConfig,
    FormFields: {
      ...formConfig.FormFields,
      patientInfo: {
        ...(formConfig.FormFields as Record<string, any>).patientInfo,
        items: { ...existingItems, ...additions },
      },
    },
  };
};

// Cached defaults — built lazily on first access, then reused for all subsequent
// proxy reads. This preserves referential stability and avoids rebuilding
// FormFields/formConfig on every BOOKING_CONFIG property access.
let _bookingDefaults: BookingConfig | undefined;
const getBookingDefaults = (): BookingConfig => {
  if (!_bookingDefaults) {
    _bookingDefaults = Object.freeze({
      ...BOOKING_DEFAULTS_DATA,
      formConfig: applyScreeningOverlayToFormConfig(getFormDefaults()),
    }) as BookingConfig;
  }
  return _bookingDefaults;
};

/**
 * Get booking configuration with optional test overrides
 *
 * @param testOverrides - Optional overrides for testing purposes
 * @returns Merged configuration
 */
export function getBookingConfig(testOverrides?: Partial<BookingConfig>): BookingConfig {
  if (!testOverrides) {
    return getBookingDefaults();
  }
  // If overrides include serviceCategories, rebuild formConfig to match
  // so the RFV field's options and display filters stay consistent. The
  // screening overlay is re-applied on the rebuilt formConfig — otherwise
  // the auto-injected in-person screening items would be lost.
  const merged = mergeAndFreezeConfigObjects(getBookingDefaults(), testOverrides) as BookingConfig;
  if (testOverrides.serviceCategories) {
    return mergeAndFreezeConfigObjects(merged, {
      formConfig: applyScreeningOverlayToFormConfig(getFormDefaults(merged.serviceCategories)),
    }) as BookingConfig;
  }
  return merged;
}

// todo: it would be nice to use zod to validate the merged booking config shape here
// Export as a getter property to allow runtime config injection in tests
export const BOOKING_CONFIG = createProxyConfigObject<BookingConfig>(getBookingConfig, CONFIG_INJECTION_KEYS.BOOKING);

// Lazy schemas — computed on each call to stay consistent with BOOKING_CONFIG,
// which may reflect runtime-injected overrides via the proxy.
// Defined as functions (not module-scope constants) to avoid eagerly accessing
// BOOKING_CONFIG during module initialization.
export const getServiceCategoryCodeSchema = (): z.ZodEnum<[string, ...string[]]> => {
  return z.enum(BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code) as [string, ...string[]]);
};
/** @deprecated Use getServiceCategoryCodeSchema() — eager access can cause circular init issues */
export const ServiceCategoryCodeSchema = new Proxy({} as z.ZodEnum<[string, ...string[]]>, {
  get(_target, prop) {
    return (getServiceCategoryCodeSchema() as any)[prop];
  },
});

export type ServiceCategoryCode = z.infer<ReturnType<typeof getServiceCategoryCodeSchema>>;

export const getHomepageOptionSchema = (): z.ZodEnum<[string, ...string[]]> => {
  return z.enum(BOOKING_CONFIG.homepageOptions.map((opt) => opt.id) as [string, ...string[]]);
};
/** @deprecated Use getHomepageOptionSchema() — eager access can cause circular init issues */
export const HomepageOptionSchema = new Proxy({} as z.ZodEnum<[string, ...string[]]>, {
  get(_target, prop) {
    return (getHomepageOptionSchema() as any)[prop];
  },
});

export type HomepageOption = z.infer<ReturnType<typeof getHomepageOptionSchema>>;

// getReasonForVisitOptionsForServiceCategory is exported from config-helpers/booking.ts
