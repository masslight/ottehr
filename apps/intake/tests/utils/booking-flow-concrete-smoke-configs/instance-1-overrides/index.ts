import { BookingStrategy, FillingStrategy } from 'tests/utils/booking/BookingTestFactory';

export const fillingStrategy: FillingStrategy = {
  checkValidation: true,
  fillAllFields: true,
};

export const bookingStrategy: BookingStrategy = {
  inPersonPrebookLocation: 'Mordor',
  virtualPrebookLocation: 'Telemed Twin Peaks',
  inPersonWalkInLocation: 'Cloverdale',
  virtualWalkInLocation: 'Telemed Cat City',
};

export const skip = false;
