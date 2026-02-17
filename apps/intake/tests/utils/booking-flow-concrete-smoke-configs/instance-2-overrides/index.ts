import { BookingStrategy, FillingStrategy, QuestionnaireFieldAddress } from 'tests/utils/booking/BookingTestFactory';

export const bookingStrategy: BookingStrategy = {
  inPersonPrebookLocation: 'Narnia',
  virtualPrebookLocation: 'Telemed Salamandastron',
  inPersonWalkInLocation: 'Macondo',
  virtualWalkInLocation: 'Telemed Westeros',
};

const verifyFieldsNotShown: QuestionnaireFieldAddress[] = [
  { pageLinkId: 'patient-details-page', fieldLinkId: 'patient-pronouns' },
  { pageLinkId: 'patient-details-page', fieldLinkId: 'patient-point-of-discovery' },
];

export const fillingStrategy: FillingStrategy = {
  checkValidation: true,
  fillAllFields: true,
  verifyFieldsNotShown,
};

export const skip = false;
