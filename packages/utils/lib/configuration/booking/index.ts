import { Coding, Questionnaire } from 'fhir/r4b';
import _ from 'lodash';
import inPersonIntakeQuestionnaireJson from '../../../../../config/oystehr/in-person-intake-questionnaire.json' assert { type: 'json' };
import virtualIntakeQuestionnaireJson from '../../../../../config/oystehr/virtual-intake-questionnaire.json' assert { type: 'json' };
import { BOOKING_OVERRIDES } from '../../../.ottehr_config';

const REASON_FOR_VISIT_OPTIONS = Object.freeze([
  'Cough and/or congestion',
  'Throat pain',
  'Eye concern',
  'Fever',
  'Ear pain',
  'Vomiting and/or diarrhea',
  'Abdominal (belly) pain',
  'Rash or skin issue',
  'Urinary problem',
  'Breathing problem',
  'Injury to arm',
  'Injury to leg',
  'Injury to head',
  'Injury (Other)',
  'Cut to arm or leg',
  'Cut to face or head',
  'Removal of sutures/stitches/staples',
  'Choked or swallowed something',
  'Allergic reaction to medication or food',
  'Other',
]);

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
const CANCEL_REASON_OPTIONS = Object.freeze([
  'Patient improved',
  'Wait time too long',
  'Prefer another provider',
  'Changing location',
  'Changing to telemedicine',
  'Financial responsibility concern',
  'Insurance issue',
]);

interface StrongCoding extends Coding {
  code: string;
  display: string;
  system: string;
}

const SERVICE_CATEGORIES_AVAILABLE: StrongCoding[] = [
  { display: 'Urgent Care', code: 'urgent_care', system: 'https://fhir.ottehr.com/CodeSystem/service-category' },
  {
    display: 'Occupational Medicine',
    code: 'occupational_medicine',
    system: 'https://fhir.ottehr.com/CodeSystem/service-category',
  },
  { display: 'Workmans Comp', code: 'workmans_comp', system: 'https://fhir.ottehr.com/CodeSystem/service-category' },
];

const BOOKING_DEFAULTS = Object.freeze({
  reasonForVisitOptions: REASON_FOR_VISIT_OPTIONS,
  cancelReasonOptions: CANCEL_REASON_OPTIONS,
  serviceCategoriesEnabled: {
    serviceModes: ['in-person', 'virtual'],
    visitType: ['prebook'],
  },
  serviceCategories: SERVICE_CATEGORIES_AVAILABLE,
  intakeQuestionnaires,
});

const mergedBookingConfig = _.merge({ ...BOOKING_DEFAULTS }, { ...BOOKING_OVERRIDES });

export const BOOKING_CONFIG = Object.freeze(mergedBookingConfig);

export const shouldShowServiceCategorySelectionPage = (params: { serviceMode: string; visitType: string }): boolean => {
  return BOOKING_CONFIG.serviceCategoriesEnabled.serviceModes.includes(params.serviceMode) &&
    BOOKING_CONFIG.serviceCategoriesEnabled.visitType.includes(params.visitType) &&
    BOOKING_CONFIG.serviceCategories.length > 1
    ? true
    : false;
};
