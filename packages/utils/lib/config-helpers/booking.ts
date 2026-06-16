import { type ServiceCategoryConfig } from 'config-types';
import {
  Patient,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
} from 'fhir/r4b';
import { FHIR_EXTENSION, getFirstName, getLastName, getMiddleName } from '../fhir';
import { makeAnswer, pickFirstValueFromAnswerItem } from '../helpers';
import { BOOKING_CONFIG, type StrongCoding } from '../ottehr-config/booking';
import { flattenQuestionnaireAnswers, PatientInfo, PersonSex } from '../types';

// Questionnaire fields that distinguish between "not provided" (undefined) vs "cleared" ('')
// Cleared fields trigger FHIR resource removal in harvest/update-visit-details zambdas
export const FIELDS_TO_TRACK_CLEARING = ['patient-preferred-name', 'authorized-non-legal-guardian'] as const;

/**
 * Extract StrongCoding objects from the service category config array.
 */
export const getServiceCategoryCodings = (): StrongCoding[] => {
  return BOOKING_CONFIG.serviceCategories.map((sc) => sc.category);
};

/**
 * Whether a service category supports a given (mode, visit type) context.
 *
 * For BOOKING_CONFIG-sourced entries, an empty `serviceModes`/`visitTypes`
 * array is treated as "supports all" — the legacy contract pre-dating the
 * multi-mode/visit-type tagging is that BOOKING_CONFIG entries were
 * universally available. For FHIR-sourced entries an empty array means
 * "explicitly supports nothing" (admin misconfiguration); we exclude them
 * so the picker doesn't silently surface an entry that can't actually be
 * booked into the requested context.
 *
 * Centralized so the picker-decision (`shouldShowServiceCategorySelectionPage`)
 * and any call site that picks the single-match category code stay in
 * agreement — if one said "two matches, show picker" while the other said
 * "no single match, no stamp," the two disagreed silently in production.
 */
export const serviceCategorySupportsContext = (
  sc: ServiceCategoryConfig & { source?: 'booking-config' | 'fhir' },
  serviceMode?: string,
  visitType?: string
): boolean => {
  const isBookingConfig = sc.source === 'booking-config';
  const modes = sc.serviceModes ?? [];
  const types = sc.visitTypes ?? [];
  // Pass undefined to skip a dimension — e.g., the picker page knows
  // visit type from the URL but not mode (mode is implied by the slot
  // owner, resolved downstream). Skipping isn't the same as "no filter"
  // for that dimension on the source: an untagged BOOKING_CONFIG entry
  // still passes via the empty-arrays-mean-all rule, an empty-arrays
  // FHIR entry is still excluded as misconfigured.
  const modesOk =
    serviceMode === undefined || modes.includes(serviceMode as any) || (isBookingConfig && modes.length === 0);
  const typesOk =
    visitType === undefined || types.includes(visitType as any) || (isBookingConfig && types.length === 0);
  return modesOk && typesOk;
};

/**
 * Get service categories available for a given service mode and visit type.
 * Returns the StrongCoding for each matching category.
 *
 * Optionally accepts an explicit list of service categories (e.g., from the
 * FHIR-backed registry). Falls back to BOOKING_CONFIG when not provided, so
 * existing call sites keep working. The BOOKING_CONFIG fallback is tagged
 * with `source: 'booking-config'` so the empty-arrays-mean-everything rule
 * in `serviceCategorySupportsContext` applies to it.
 */
export const getServiceCategoriesForContext = (
  serviceMode: string,
  visitType: string,
  serviceCategories?: Array<ServiceCategoryConfig & { source?: 'booking-config' | 'fhir' }>
): StrongCoding[] => {
  const source: Array<ServiceCategoryConfig & { source?: 'booking-config' | 'fhir' }> =
    serviceCategories ?? BOOKING_CONFIG.serviceCategories.map((sc) => ({ ...sc, source: 'booking-config' as const }));
  return source.filter((sc) => serviceCategorySupportsContext(sc, serviceMode, visitType)).map((sc) => sc.category);
};

/**
 * Determine whether to show the service category selection page.
 * Returns true when more than one category matches the given mode and visit type.
 */
export const shouldShowServiceCategorySelectionPage = (params: {
  serviceMode: string;
  visitType: string;
  serviceCategories?: Array<ServiceCategoryConfig & { source?: 'booking-config' | 'fhir' }>;
}): boolean => {
  return getServiceCategoriesForContext(params.serviceMode, params.visitType, params.serviceCategories).length > 1;
};

/**
 * Pure resolver: get reason-for-visit options from a list of service categories.
 *
 * Resolution order:
 * 1. If the category config has reasonsForVisit[serviceMode], use it
 * 2. If the category config has reasonsForVisit.default, use it
 *
 * When serviceMode is omitted (e.g., EHR context), returns the default or
 * a combined list of all mode-specific options for the category.
 */
export const resolveReasonForVisitOptions = (
  serviceCategories: ServiceCategoryConfig[],
  serviceCategory: string,
  serviceMode?: string
): { value: string; label: string }[] => {
  const categoryConfig = serviceCategories.find((sc) => sc.category.code === serviceCategory);
  if (!categoryConfig?.reasonsForVisit) {
    return [];
  }

  const rfv = categoryConfig.reasonsForVisit;

  if (serviceMode) {
    const modeKey = serviceMode as keyof typeof rfv;
    if (rfv[modeKey]) {
      return [...rfv[modeKey]!];
    }
    if (rfv.default) {
      return [...rfv.default];
    }
  }

  if (rfv.default) {
    return [...rfv.default];
  }

  // No mode specified and no default: combine all mode-specific lists
  const combined = new Map<string, { value: string; label: string }>();
  for (const options of Object.values(rfv)) {
    if (options) {
      for (const opt of options) {
        combined.set(opt.value, opt);
      }
    }
  }
  return [...combined.values()];
};

/**
 * Get reason-for-visit options for a given service category and optional service mode,
 * using the active BOOKING_CONFIG.
 */
export const getReasonForVisitOptionsForServiceCategory = (
  serviceCategory: string,
  serviceMode?: string
): { value: string; label: string }[] => {
  return resolveReasonForVisitOptions(BOOKING_CONFIG.serviceCategories, serviceCategory, serviceMode);
};

// Helper to normalize form data by converting empty objects to proper questionnaire response format
// react-hook-form returns {} for conditionally hidden fields with disabled-display extension
export const normalizeFormDataToQRItems = (data: Record<string, unknown>): QuestionnaireResponseItem[] => {
  return Object.entries(data)
    .map(([key, value]) => {
      // Skip empty objects that are not tracked fields
      if (value && typeof value === 'object' && Object.keys(value).length === 0) {
        return FIELDS_TO_TRACK_CLEARING.includes(key as (typeof FIELDS_TO_TRACK_CLEARING)[number])
          ? { linkId: key, answer: [] }
          : null;
      }
      return value;
    })
    .filter((item): item is QuestionnaireResponseItem => item !== null) as QuestionnaireResponseItem[];
};

export const mapBookingQRItemToPatientInfo = (qrItem: QuestionnaireResponseItem[]): PatientInfo => {
  const items = flattenQuestionnaireAnswers(qrItem);
  const patientInfo: PatientInfo = {};
  items.forEach((item) => {
    switch (item.linkId) {
      case 'existing-patient-id':
        patientInfo.id = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-first-name':
        patientInfo.firstName = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-middle-name':
        patientInfo.middleName = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-last-name':
        patientInfo.lastName = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-birthdate':
        patientInfo.dateOfBirth = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'authorized-non-legal-guardian':
        patientInfo.authorizedNonLegalGuardians = pickFirstValueFromAnswerItem(item, 'string') || '';
        break;
      case 'patient-email':
        patientInfo.email = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-phone-number':
        patientInfo.phoneNumber = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'reason-for-visit':
      case 'reason-for-visit-om':
      case 'reason-for-visit-wc':
      case 'reason-for-visit-po':
        patientInfo.reasonForVisit = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'tell-us-more':
        patientInfo.reasonAdditional = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-preferred-name':
        patientInfo.chosenName = pickFirstValueFromAnswerItem(item, 'string') || '';
        break;
      case 'patient-ssn':
        patientInfo.ssn = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-birth-sex':
        patientInfo.sex = PersonSex[pickFirstValueFromAnswerItem(item, 'string') as keyof typeof PersonSex];
        break;
      case 'patient-weight':
        // eslint-disable-next-line no-case-declarations
        const weight = parseFloat(pickFirstValueFromAnswerItem(item, 'string') || '');
        patientInfo.weight = Number.isNaN(weight) ? undefined : weight;
        break;
      case 'return-patient-check':
        patientInfo.patientBeenSeenBefore =
          (pickFirstValueFromAnswerItem(item, 'string') ?? 'no').toLowerCase() === 'yes';
        break;
      default:
        break;
    }
  });
  return patientInfo;
};

interface BookingContext {
  serviceMode: 'in-person' | 'virtual';
  serviceCategoryCode: string;
}

export interface BookingFormPrePopulationInput {
  questionnaire: Questionnaire;
  context: BookingContext;
  patient?: Patient;
  patientInfoHiddenFields?: string[];
}

export const prepopulateBookingForm = (input: BookingFormPrePopulationInput): QuestionnaireResponseItem[] => {
  const {
    patient,
    questionnaire,
    context: { serviceMode, serviceCategoryCode },
    patientInfoHiddenFields = (BOOKING_CONFIG.FormFields as any)?.patientInfo?.hiddenFields,
  } = input;
  console.log(
    'making prepopulated items for booking form with serviceMode, serviceCategoryCode',
    serviceMode,
    serviceCategoryCode
  );

  let patientSex: string | undefined;
  if (patient?.gender === 'male') {
    patientSex = 'Male';
  } else if (patient?.gender === 'female') {
    patientSex = 'Female';
  } else if (patient?.gender !== undefined) {
    patientSex = 'Intersex';
  }
  const patientPreferredName = patient?.name?.find((name) => name.use === 'nickname')?.given?.[0];
  const patientEmail = patient?.telecom?.find((c) => c.system === 'email' && c.period?.end === undefined)?.value;

  const authorizedNLG = patient?.extension?.find(
    (e) => e.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url
  )?.valueString;

  const ssn = patient?.identifier?.find(
    (id) =>
      id.type?.coding?.some((c) => c.system === 'http://terminology.hl7.org/CodeSystem/v2-0203' && c.code === 'SS') &&
      id.period?.end === undefined
  )?.value;

  // assuming here we never need to collect this when we already have it
  const shouldShowSSNField = !ssn && !patientInfoHiddenFields?.includes('patient-ssn');
  const ssnRequired = serviceCategoryCode === 'workers-comp' && shouldShowSSNField;

  const item: QuestionnaireResponseItem[] = (questionnaire.item ?? []).map((item) => {
    const populatedItem: QuestionnaireResponseItem[] = (() => {
      const itemItems = (item.item ?? [])
        .filter((i: QuestionnaireItem) => i.type !== 'display')
        .map((subItem) => {
          const { linkId } = subItem;
          let answer: QuestionnaireResponseItemAnswer[] | undefined;
          if (linkId === 'existing-patient-id' && patient?.id) {
            answer = makeAnswer(patient.id);
          }
          if (linkId === 'should-display-ssn-field') {
            answer = makeAnswer(shouldShowSSNField, 'Boolean');
          }
          if (linkId === 'ssn-field-required') {
            answer = makeAnswer(ssnRequired, 'Boolean');
          }
          if (linkId === 'appointment-service-category') {
            answer = makeAnswer(serviceCategoryCode);
          }
          if (linkId === 'appointment-service-mode') {
            answer = makeAnswer(serviceMode);
          }
          if (linkId === 'patient-first-name' && patient) {
            answer = makeAnswer(getFirstName(patient) ?? '');
          }
          if (linkId === 'patient-last-name' && patient) {
            answer = makeAnswer(getLastName(patient) ?? '');
          }

          if (linkId === 'patient-middle-name' && patient) {
            answer = makeAnswer(getMiddleName(patient) ?? '');
          }
          if (linkId === 'patient-preferred-name' && patientPreferredName) {
            answer = makeAnswer(patientPreferredName);
          }
          if (linkId === 'patient-birthdate' && patient?.birthDate) {
            answer = makeAnswer(patient.birthDate);
          }
          if (linkId === 'patient-birth-sex' && patientSex) {
            answer = makeAnswer(patientSex);
          }
          if (linkId === 'patient-email' && patientEmail) {
            answer = makeAnswer(patientEmail);
          }
          if (linkId === 'authorized-non-legal-guardian' && authorizedNLG) {
            answer = makeAnswer(authorizedNLG);
          }

          return {
            linkId,
            answer,
          };
        });
      return itemItems;
    })();
    return {
      linkId: item.linkId,
      item: populatedItem,
    };
  });

  return item;
};
