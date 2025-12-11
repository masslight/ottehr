import {
  Coding,
  Patient,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  Slot,
} from 'fhir/r4b';
import _ from 'lodash';
import z from 'zod';
import bookAppointmentQuestionnaireJson from '../../../../../config/oystehr/book-appointment-questionnaire.json' assert { type: 'json' };
import inPersonIntakeQuestionnaireJson from '../../../../../config/oystehr/in-person-intake-questionnaire.json' assert { type: 'json' };
import virtualIntakeQuestionnaireJson from '../../../../../config/oystehr/virtual-intake-questionnaire.json' assert { type: 'json' };
import { BOOKING_OVERRIDES } from '../../../.ottehr_config';
import { FHIR_EXTENSION, getFirstName, getLastName, getMiddleName, OTTEHR_CODE_SYSTEM_BASE_URL } from '../../fhir';
import { makeAnswer, pickFirstValueFromAnswerItem } from '../../helpers';
import { flattenQuestionnaireAnswers, PatientInfo, PersonSex } from '../../types';
import { mergeAndFreezeConfigObjects } from '../helpers';

const BookingQuestionnaire = Object.values(bookAppointmentQuestionnaireJson.fhirResources)![0]
  .resource as Questionnaire;

const REASON_FOR_VISIT_OPTIONS =
  BookingQuestionnaire.item![0].item!.find(
    (item: QuestionnaireItem) => item.linkId === 'reason-for-visit'
  )!.answerOption?.map((option: any) => option.valueString) ?? [];

export const intakeQuestionnaires: Readonly<Array<Questionnaire>> = (() => {
  const inPersonQ = Object.values(inPersonIntakeQuestionnaireJson.fhirResources).find(
    (q) =>
      q.resource.resourceType === 'Questionnaire' &&
      q.resource.status === 'active' &&
      q.resource.url.includes('intake-paperwork-inperson')
  )?.resource as Questionnaire | undefined;
  const virtualQ = Object.values(virtualIntakeQuestionnaireJson.fhirResources).find(
    (q) =>
      q.resource.resourceType === 'Questionnaire' &&
      q.resource.status === 'active' &&
      q.resource.url.includes('intake-paperwork-virtual')
  )?.resource as Questionnaire | undefined;
  const questionnaires = new Array<Questionnaire>();
  if (inPersonQ) {
    questionnaires.push(inPersonQ);
  }
  if (virtualQ) {
    questionnaires.push(virtualQ);
  }
  return questionnaires;
})();

const bookAppointmentQuestionnaire: {
  url: string | undefined;
  version: string | undefined;
  templateQuestionnaire: Questionnaire | undefined;
} = (() => {
  const templateResource = _.cloneDeep(BookingQuestionnaire);
  return {
    url: templateResource?.url,
    version: templateResource?.version,
    templateQuestionnaire: templateResource as Questionnaire,
  };
})();

const CANCEL_REASON_OPTIONS = [
  'Patient improved',
  'Wait time too long',
  'Prefer another provider',
  'Changing location',
  'Changing to telemedicine',
  'Financial responsibility concern',
  'Insurance issue',
];

interface StrongCoding extends Coding {
  code: string;
  display: string;
  system: string;
}

const SERVICE_CATEGORIES_AVAILABLE: StrongCoding[] = [
  { display: 'Urgent Care', code: 'urgent-care', system: `${OTTEHR_CODE_SYSTEM_BASE_URL}/service-category` },
  {
    display: 'Occupational Medicine',
    code: 'occupational-medicine',
    system: `${OTTEHR_CODE_SYSTEM_BASE_URL}/service-category`,
  },
  { display: 'Workmans Comp', code: 'workmans-comp', system: `${OTTEHR_CODE_SYSTEM_BASE_URL}/service-category` },
];

interface BookingContext {
  serviceMode: 'in-person' | 'virtual';
  serviceCategoryCode: string;
}
interface BookingFormPrePopulationInput {
  questionnaire: Questionnaire;
  context: BookingContext;
  patient?: Patient;
}

const mapBookingQRItemToPatientInfo = (qrItem: QuestionnaireResponseItem[]): PatientInfo => {
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
        patientInfo.authorizedNonLegalGuardians = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-email':
        patientInfo.email = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-phone-number':
        patientInfo.phoneNumber = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'reason-for-visit':
        patientInfo.reasonForVisit = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'tell-us-more':
        patientInfo.reasonAdditional = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-preferred-name':
        patientInfo.chosenName = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-ssn':
        patientInfo.ssn = pickFirstValueFromAnswerItem(item, 'string');
        break;
      case 'patient-birth-sex':
        patientInfo.sex = PersonSex[pickFirstValueFromAnswerItem(item, 'string') as keyof typeof PersonSex];
        break;
      default:
        break;
    }
  });
  return patientInfo;
};

type BookingQuestionnaireLinkId = NonNullable<
  NonNullable<typeof BookingQuestionnaire.item>[number]['item']
>[number]['linkId'];

const hiddenBookingFields: BookingQuestionnaireLinkId[] = [];

const BOOKING_DEFAULTS = {
  reasonForVisitOptions: REASON_FOR_VISIT_OPTIONS,
  cancelReasonOptions: CANCEL_REASON_OPTIONS,
  serviceCategoriesEnabled: {
    serviceModes: ['in-person', 'virtual'],
    visitType: ['prebook'],
  },
  hiddenBookingFields,
  serviceCategories: SERVICE_CATEGORIES_AVAILABLE,
  intakeQuestionnaires,
  selectBookingQuestionnaire: (
    _slot?: Slot
  ): { url: string; version: string; templateQuestionnaire: Questionnaire } => {
    // can read properties of slot to determine which questionnaire to return
    // if desired. by default, we return just a single questionnaire regardless of slot
    if (
      bookAppointmentQuestionnaire.url &&
      bookAppointmentQuestionnaire.version &&
      bookAppointmentQuestionnaire.templateQuestionnaire
    ) {
      return JSON.parse(JSON.stringify(bookAppointmentQuestionnaire));
    }
    throw new Error('No booking questionnaire configured');
  },
  mapBookingQRItemToPatientInfo,
};

// todo: it would be nice to use zod to validate the merged booking config shape here
export const BOOKING_CONFIG = mergeAndFreezeConfigObjects(BOOKING_DEFAULTS, BOOKING_OVERRIDES);

export const shouldShowServiceCategorySelectionPage = (params: { serviceMode: string; visitType: string }): boolean => {
  return BOOKING_CONFIG.serviceCategoriesEnabled.serviceModes.includes(params.serviceMode) &&
    BOOKING_CONFIG.serviceCategoriesEnabled.visitType.includes(params.visitType) &&
    BOOKING_CONFIG.serviceCategories.length > 1
    ? true
    : false;
};

export const ServiceCategoryCodeSchema = z.enum(
  BOOKING_CONFIG.serviceCategories.map((category) => category.code) as [string, ...string[]]
);

export type ServiceCategoryCode = z.infer<typeof ServiceCategoryCodeSchema>;

export const prepopulateBookingForm = (input: BookingFormPrePopulationInput): QuestionnaireResponseItem[] => {
  const {
    patient,
    questionnaire,
    context: { serviceMode, serviceCategoryCode },
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
  const shouldShowSSNField = !ssn && !BOOKING_CONFIG.hiddenBookingFields.includes('patient-ssn');
  const ssnRequired = serviceCategoryCode === 'workmans_comp' && shouldShowSSNField;

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
