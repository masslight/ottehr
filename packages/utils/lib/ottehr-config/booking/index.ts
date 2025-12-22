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
import inPersonIntakeQuestionnaireJson from '../../../../../config/oystehr/in-person-intake-questionnaire.json' assert { type: 'json' };
import virtualIntakeQuestionnaireJson from '../../../../../config/oystehr/virtual-intake-questionnaire.json' assert { type: 'json' };
import { BOOKING_OVERRIDES } from '../../../ottehr-config-overrides';
import { FHIR_EXTENSION, getFirstName, getLastName, getMiddleName, SERVICE_CATEGORY_SYSTEM } from '../../fhir';
import { makeAnswer, pickFirstValueFromAnswerItem } from '../../helpers';
import { flattenQuestionnaireAnswers, PatientInfo, PersonSex } from '../../types';
import { mergeAndFreezeConfigObjects } from '../helpers';
import {
  createQuestionnaireFromConfig,
  FormFieldTrigger,
  FormSectionSimpleSchema,
  QuestionnaireBase,
  QuestionnaireConfigSchema,
} from '../shared-questionnaire';
import { VALUE_SETS } from '../value-sets';

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
      reasonForVisit: {
        key: 'reason-for-visit',
        label: 'Reason for visit',
        type: 'choice',
        options: VALUE_SETS.reasonForVisitOptions,
      },
      tellUsMore: {
        key: 'tell-us-more',
        label: 'Tell us more (optional)',
        type: 'string',
      },
      authorizedNonLegalGuardians: {
        key: 'authorized-non-legal-guardian',
        label: 'Who, besides the parent or legal guardian, is allowed to bring in the patient?',
        type: 'string',
      },
    },
    hiddenFields: [],
    requiredFields: ['patient-birth-sex', 'patient-email', 'reason-for-visit'],
  },
};

const FormFieldsSchema = z.object({
  patientInfo: FormSectionSimpleSchema,
});

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

const mergedBookingQConfig = _.merge(FORM_DEFAULTS, BOOKING_OVERRIDES.formConfig ?? {});

const BookingPaperworkConfigSchema = QuestionnaireConfigSchema.extend({
  FormFields: FormFieldsSchema,
});

const formConfig = BookingPaperworkConfigSchema.parse(mergedBookingQConfig);

const BOOKING_QUESTIONNAIRE = (): Questionnaire =>
  JSON.parse(JSON.stringify(createQuestionnaireFromConfig(formConfig)));

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

interface StrongCoding extends Coding {
  code: string;
  display: string;
  system: string;
}

const SERVICE_CATEGORIES_AVAILABLE: StrongCoding[] = [
  { display: 'Urgent Care', code: 'urgent-care', system: SERVICE_CATEGORY_SYSTEM },
  {
    display: 'Occupational Medicine',
    code: 'occupational-medicine',
    system: SERVICE_CATEGORY_SYSTEM,
  },
  { display: 'Workmans Comp', code: 'workmans-comp', system: SERVICE_CATEGORY_SYSTEM },
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

const BOOKING_DEFAULTS = {
  serviceCategoriesEnabled: {
    serviceModes: ['in-person', 'virtual'],
    visitType: ['prebook', 'walk-in'],
  },
  homepageOptions: [
    'start-in-person-visit',
    'schedule-in-person-visit',
    'start-virtual-visit',
    'schedule-virtual-visit',
  ],
  serviceCategories: SERVICE_CATEGORIES_AVAILABLE,
  intakeQuestionnaires,
  selectBookingQuestionnaire: (
    _slot?: Slot
  ): { url: string; version: string; templateQuestionnaire: Questionnaire } => {
    // can read properties of slot to determine which questionnaire to return
    // if desired. by default, we return just a single questionnaire regardless of slot
    const Q = BOOKING_QUESTIONNAIRE();
    if (!Q.url || !Q.version) {
      throw new Error('Booking questionnaire is missing url or version');
    }
    return { url: Q.url, version: Q.version, templateQuestionnaire: Q };
  },
  mapBookingQRItemToPatientInfo,
  formConfig,
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

export const HomepageOptionSchema = z.enum(BOOKING_CONFIG.homepageOptions as [string, ...string[]]);

export type HomepageOption = z.infer<typeof HomepageOptionSchema>;

export function getEnabledHomepageOptions(): HomepageOption[] {
  return BOOKING_CONFIG.homepageOptions ?? [];
}

export function getFirstEnabledHomepageOptionTestId(): string | undefined {
  const enabledOptions = getEnabledHomepageOptions();
  if (enabledOptions.length === 0) {
    return undefined;
  }
  return enabledOptions.map((option) => `${option}-button`)[0];
}

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
  const shouldShowSSNField = !ssn && !formConfig.FormFields.patientInfo.hiddenFields?.includes('patient-ssn');
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
