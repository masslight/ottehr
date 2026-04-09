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
import { SERVICE_CATEGORY_SYSTEM } from '../../fhir';
import { CanonicalUrl } from '../../types';
import { BRANDING_CONFIG } from '../branding';
import { createQuestionnaireFromConfig } from '../shared-questionnaire';
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
  },
  {
    category: { display: 'Occupational Medicine', code: 'occupational-medicine', system: SERVICE_CATEGORY_SYSTEM },
    serviceModes: ['in-person', 'virtual'],
    visitTypes: ['prebook', 'walk-in'],
  },
  {
    category: { display: 'Workers Comp', code: 'workers-comp', system: SERVICE_CATEGORY_SYSTEM },
    serviceModes: ['in-person', 'virtual'],
    visitTypes: ['prebook', 'walk-in'],
  },
];

/**
 * Build a single reason-for-visit form field from service category configs that have reasonsForVisit.
 * Returns null if no category defines reasonsForVisit (fall back to legacy per-category fields).
 *
 * The generated field has:
 * - options: deduplicated union of all RFV values across all categories/modes (the full value set)
 * - triggers: enable when appointment-service-category matches any category with reasonsForVisit
 * - answerDisplayFilters: one filter per category+mode combo, specifying which options to show
 */
const buildReasonForVisitFromConfig = (serviceCategories: ServiceCategoryConfig[]): Record<string, unknown> | null => {
  const categoriesWithRfv = serviceCategories.filter((sc) => sc.reasonsForVisit);
  if (categoriesWithRfv.length === 0) return null;

  // Collect all unique options across all categories/modes
  const allOptions = new Map<string, { label: string; value: string }>();
  // Build display filters and enable triggers
  const displayFilters: {
    conditions: { question: string; operator: string; answer: string }[];
    includeValues: string[];
  }[] = [];
  const enableTriggers: FormFieldTrigger[] = [];

  for (const sc of categoriesWithRfv) {
    const rfv = sc.reasonsForVisit!;

    // Add an enable trigger for this category
    enableTriggers.push({
      targetQuestionLinkId: 'appointment-service-category',
      effect: ['enable', 'require'],
      operator: '=',
      answerString: sc.category.code,
    });

    // For each mode this category supports, generate a display filter
    for (const mode of sc.serviceModes) {
      const modeOptions = rfv[mode] ?? rfv.default;
      if (!modeOptions) continue;

      // Add all options to the superset
      for (const opt of modeOptions) {
        allOptions.set(opt.value, opt);
      }

      // Build filter conditions
      const conditions: { question: string; operator: string; answer: string }[] = [
        { question: 'appointment-service-category', operator: '=', answer: sc.category.code },
        { question: 'appointment-service-mode', operator: '=', answer: mode },
      ];

      displayFilters.push({
        conditions,
        includeValues: modeOptions.map((o) => o.value),
      });
    }

    // If there's a default with no mode-specific entries, also add options from default
    if (rfv.default) {
      for (const opt of rfv.default) {
        allOptions.set(opt.value, opt);
      }
    }
  }

  return {
    reasonForVisit: {
      key: 'reason-for-visit',
      label: 'Reason for visit',
      type: 'choice',
      options: [...allOptions.values()],
      triggers: enableTriggers,
      disabledDisplay: 'hidden',
      enableBehavior: 'any',
      answerDisplayFilters: displayFilters,
    },
  };
};

const FormFields: Record<string, FormFieldSection> = {
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
      // Reason-for-visit fields: if any service category defines reasonsForVisit,
      // generate a single field with display filters; otherwise fall back to legacy per-category fields
      ...(buildReasonForVisitFromConfig(SERVICE_CATEGORIES_AVAILABLE) ?? {
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
        ...(VALUE_SETS.reasonForVisitOptionsPreOp
          ? {
              reasonForVisitPreOp: {
                key: 'reason-for-visit-po',
                label: 'Reason for visit',
                type: 'choice',
                options: VALUE_SETS.reasonForVisitOptionsPreOp,
                triggers: [
                  {
                    targetQuestionLinkId: 'appointment-service-category',
                    effect: ['enable', 'require'],
                    operator: '=',
                    answerString: 'pre-op',
                  },
                ],
                disabledDisplay: 'hidden',
              },
            }
          : {}),
      }),
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
    hiddenFields: [],
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

const formConfig = FORM_DEFAULTS;

const BOOKING_QUESTIONNAIRE = (): Questionnaire =>
  JSON.parse(JSON.stringify(createQuestionnaireFromConfig(formConfig)));

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

export const ServiceCategoryCodeSchema = z.enum(
  BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code) as [string, ...string[]]
);

export type ServiceCategoryCode = z.infer<typeof ServiceCategoryCodeSchema>;

export const HomepageOptionSchema = z.enum(
  BOOKING_CONFIG.homepageOptions.map((opt) => opt.id) as [string, ...string[]]
);

export type HomepageOption = z.infer<typeof HomepageOptionSchema>;

/**
 * Get reason-for-visit options for a given service category and optional service mode.
 *
 * Resolution order:
 * 1. If the category config has reasonsForVisit[serviceMode], use it
 * 2. If the category config has reasonsForVisit.default, use it
 * 3. Fall back to legacy VALUE_SETS pattern
 *
 * When serviceMode is omitted (e.g., EHR context), returns the default or
 * a combined list of all mode-specific options for the category.
 */
export const getReasonForVisitOptionsForServiceCategory = (
  serviceCategory: string,
  serviceMode?: string
): { value: string; label: string }[] => {
  // Try new-shape config first
  const categoryConfig = BOOKING_CONFIG.serviceCategories.find((sc) => sc.category.code === serviceCategory);
  if (categoryConfig?.reasonsForVisit) {
    const rfv = categoryConfig.reasonsForVisit;

    // If service mode specified, try mode-specific then default
    if (serviceMode) {
      const modeKey = serviceMode as keyof typeof rfv;
      if (rfv[modeKey]) {
        return [...rfv[modeKey]!];
      }
      if (rfv.default) {
        return [...rfv.default];
      }
    }

    // No mode specified: return default, or combine all mode-specific lists
    if (rfv.default) {
      return [...rfv.default];
    }
    const combined = new Map<string, { value: string; label: string }>();
    for (const options of Object.values(rfv)) {
      if (options) {
        for (const opt of options) {
          combined.set(opt.value, opt);
        }
      }
    }
    return [...combined.values()];
  }

  // Legacy VALUE_SETS fallback
  if (serviceCategory === 'occupational-medicine') {
    return [...VALUE_SETS.reasonForVisitOptionsOccMed];
  }
  if (serviceCategory === 'workers-comp') {
    return [...VALUE_SETS.reasonForVisitOptionsWorkersComp];
  }
  if (serviceCategory === 'pre-op') {
    return VALUE_SETS.reasonForVisitOptionsPreOp ? [...VALUE_SETS.reasonForVisitOptionsPreOp] : [];
  }
  if (serviceCategory === 'urgent-care') {
    return [...VALUE_SETS.reasonForVisitOptions];
  }
  return [];
};
