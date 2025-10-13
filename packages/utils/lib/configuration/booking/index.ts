import _ from 'lodash';
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

const BOOKING_DEFAULTS = Object.freeze({
  reasonForVisitOptions: REASON_FOR_VISIT_OPTIONS,
});

const mergedBookingConfig = _.merge({ ...BOOKING_DEFAULTS }, { ...BOOKING_OVERRIDES });

export const BOOKING_CONFIG = Object.freeze(mergedBookingConfig);
