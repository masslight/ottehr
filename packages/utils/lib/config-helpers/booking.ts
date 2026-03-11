import {
  Patient,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
} from 'fhir/r4b';
import { FHIR_EXTENSION, getFirstName, getLastName, getMiddleName } from '../fhir';
import { makeAnswer, pickFirstValueFromAnswerItem } from '../helpers';
import { flattenQuestionnaireAnswers, PatientInfo, PersonSex } from '../types';

// Questionnaire fields that distinguish between "not provided" (undefined) vs "cleared" ('')
// Cleared fields trigger FHIR resource removal in harvest/update-visit-details zambdas
export const FIELDS_TO_TRACK_CLEARING = ['patient-preferred-name', 'authorized-non-legal-guardian'] as const;

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
    patientInfoHiddenFields,
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
