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

export const intakeQuestionnaireUrls: Readonly<Array<string>> = (() => {
  const inPersonUrl = inPersonIntakeQuestionnaireJson.fhirResources['questionnaire-in-person-previsit'].resource.url;
  const virtualUrl = virtualIntakeQuestionnaireJson.fhirResources['questionnaire-virtual-previsit'].resource.url;
  const urls = new Array<string>();
  if (inPersonUrl) {
    urls.push(inPersonUrl);
  }
  if (virtualUrl) {
    urls.push(virtualUrl);
  }
  return urls;
})();

const BOOKING_DEFAULTS = Object.freeze({
  reasonForVisitOptions: REASON_FOR_VISIT_OPTIONS,
  intakeQuestionnaireUrls,
});

const mergedBookingConfig = _.merge({ ...BOOKING_DEFAULTS }, { ...BOOKING_OVERRIDES });

export const BOOKING_CONFIG = Object.freeze(mergedBookingConfig);
