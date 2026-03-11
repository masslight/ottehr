import { HomepageOptions } from 'config-types';
import { Coding, Patient, Questionnaire, QuestionnaireResponseItem, Slot } from 'fhir/r4b';
import z from 'zod';
import {
  FIELDS_TO_TRACK_CLEARING as _FIELDS_TO_TRACK_CLEARING,
  mapBookingQRItemToPatientInfo as _mapBookingQRItemToPatientInfo,
  normalizeFormDataToQRItems as _normalizeFormDataToQRItems,
  prepopulateBookingForm as _prepopulateBookingForm,
} from '../../config-helpers/booking';
import {
  CONFIG_INJECTION_KEYS,
  createProxyConfigObject,
  mergeAndFreezeConfigObjects,
} from '../../config-helpers/helpers';
import { SERVICE_CATEGORY_SYSTEM } from '../../fhir';
import { CanonicalUrl } from '../../types';
import { BRANDING_CONFIG } from '../branding';
import type { QuestionnaireConfigType } from '../shared-questionnaire';
import { createQuestionnaireFromConfig, type FormFieldTrigger, type QuestionnaireBase } from '../shared-questionnaire';
import { VALUE_SETS } from '../value-sets';

// Re-export extracted helpers for backward compatibility
export const FIELDS_TO_TRACK_CLEARING = _FIELDS_TO_TRACK_CLEARING;
export const normalizeFormDataToQRItems = _normalizeFormDataToQRItems;
export const mapBookingQRItemToPatientInfo = _mapBookingQRItemToPatientInfo;

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

const FormFields = {
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
      reasonForVisit: {
        key: 'reason-for-visit',
        label: 'Reason for visit',
        type: 'choice',
        options: VALUE_SETS.reasonForVisitOptions,
        triggers: [
          {
            targetQuestionLinkId: 'appointment-service-category',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: 'urgent-care',
          },
          {
            targetQuestionLinkId: 'appointment-service-category',
            effect: ['enable', 'require'],
            operator: 'exists',
            answerBoolean: false,
          },
        ],
        disabledDisplay: 'hidden',
        enableBehavior: 'any',
      },
      reasonForVisitOccMed: {
        key: 'reason-for-visit-om',
        label: 'Reason for visit',
        type: 'choice',
        options: VALUE_SETS.reasonForVisitOptionsOccMed,
        triggers: [
          {
            targetQuestionLinkId: 'appointment-service-category',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: 'occupational-medicine',
          },
        ],
        disabledDisplay: 'hidden',
      },
      reasonForVisitWorkersComp: {
        key: 'reason-for-visit-wc',
        label: 'Reason for visit',
        type: 'choice',
        options: VALUE_SETS.reasonForVisitOptionsWorkersComp,
        triggers: [
          {
            targetQuestionLinkId: 'appointment-service-category',
            effect: ['enable', 'require'],
            operator: '=',
            answerString: 'workers-comp',
          },
        ],
        disabledDisplay: 'hidden',
      },
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
    hiddenFields: ['return-patient-check'],
    requiredFields: ['patient-birth-sex', 'patient-email'],
  },
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

const FORM_DEFAULTS = {
  questionnaireBase: questionnaireBaseDefaults,
  hiddenFormSections,
  FormFields,
};

export const SERVICE_CATEGORIES_AVAILABLE: StrongCoding[] = [
  { display: 'Urgent Care', code: 'urgent-care', system: SERVICE_CATEGORY_SYSTEM },
  {
    display: 'Occupational Medicine',
    code: 'occupational-medicine',
    system: SERVICE_CATEGORY_SYSTEM,
  },
  { display: 'Workers Comp', code: 'workers-comp', system: SERVICE_CATEGORY_SYSTEM },
];

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
  serviceCategoriesEnabled: {
    serviceModes: ['in-person', 'virtual'],
    visitType: ['prebook', 'walk-in'],
  },
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

const formConfig = FORM_DEFAULTS as unknown as QuestionnaireConfigType;

const BOOKING_QUESTIONNAIRE = (): Questionnaire =>
  JSON.parse(JSON.stringify(createQuestionnaireFromConfig(formConfig)));

interface BookingContext {
  serviceMode: 'in-person' | 'virtual';
  serviceCategoryCode: string;
}

// Backward-compatible interface (without patientInfoHiddenFields)
interface BookingFormPrePopulationInput {
  questionnaire: Questionnaire;
  context: BookingContext;
  patient?: Patient;
}

// Backward-compatible wrapper that passes hiddenFields from the module's own config
export const prepopulateBookingForm = (input: BookingFormPrePopulationInput): QuestionnaireResponseItem[] => {
  return _prepopulateBookingForm({
    ...input,
    patientInfoHiddenFields: FormFields.patientInfo.hiddenFields,
  });
};

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
  serviceCategoriesEnabled: {
    serviceModes: string[];
    visitType: string[];
  };
  homepageOptions: BookingOption[];
  ehrBookingOptions: BookingOption[];
  serviceCategories: StrongCoding[];
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

const BOOKING_DEFAULTS: BookingConfig = {
  ...BOOKING_DEFAULTS_DATA,
  formConfig,
};

/**
 * Get booking configuration with optional test overrides
 *
 * @param testOverrides - Optional overrides for testing purposes
 * @returns Merged configuration
 */
export function getBookingConfig(testOverrides?: Partial<BookingConfig>): BookingConfig {
  if (!testOverrides) {
    return BOOKING_DEFAULTS;
  }
  // Type assertion needed: DeepMerge with Partial<T> produces T | undefined properties,
  // but lodash merge skips undefined values so the base config properties are preserved.
  return mergeAndFreezeConfigObjects(BOOKING_DEFAULTS, testOverrides) as BookingConfig;
}

// todo: it would be nice to use zod to validate the merged booking config shape here
// Export as a getter property to allow runtime config injection in tests
export const BOOKING_CONFIG = createProxyConfigObject<BookingConfig>(getBookingConfig, CONFIG_INJECTION_KEYS.BOOKING);

export const shouldShowServiceCategorySelectionPage = (params: { serviceMode: string; visitType: string }): boolean => {
  return (
    (BOOKING_CONFIG.serviceCategoriesEnabled.serviceModes as string[]).includes(params.serviceMode) &&
    (BOOKING_CONFIG.serviceCategoriesEnabled.visitType as string[]).includes(params.visitType) &&
    BOOKING_CONFIG.serviceCategories.length > 1
  );
};

export const ServiceCategoryCodeSchema = z.enum(
  BOOKING_CONFIG.serviceCategories.map((category: { code: string }) => category.code) as [string, ...string[]]
);

export type ServiceCategoryCode = z.infer<typeof ServiceCategoryCodeSchema>;

export const HomepageOptionSchema = z.enum(
  BOOKING_CONFIG.homepageOptions.map((opt) => opt.id) as [string, ...string[]]
);

export type HomepageOption = z.infer<typeof HomepageOptionSchema>;

export const getReasonForVisitOptionsForServiceCategory = (
  serviceCategory: string
): { value: string; label: string }[] => {
  if (serviceCategory === 'occupational-medicine') {
    return [...VALUE_SETS.reasonForVisitOptionsOccMed];
  }
  if (serviceCategory === 'workers-comp') {
    return [...VALUE_SETS.reasonForVisitOptionsWorkersComp];
  }
  if (serviceCategory === 'urgent-care') {
    return [...VALUE_SETS.reasonForVisitOptions];
  }
  return [];
};
