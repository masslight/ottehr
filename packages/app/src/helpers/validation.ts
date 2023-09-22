import { DateTime } from 'luxon';
import { isoStringFromMDYString } from './dateUtils';

export const MINIMUM_AGE = 0;
export const MAXIMUM_AGE = 26;
export const emailRegex = /^\S+@\S+\.\S+$/;
export const stateRegex = /^[A-Za-z]{2}$/;
export const zipRegex = /^\d{5}$/;
export const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
export const cardExpirationRegex = /^\d{2} \/ \d{2}$/;

export function ageIsInRange(dateOfBirth: string): boolean {
  // make sure string is in iso format
  const iso = isoStringFromMDYString(dateOfBirth);
  const age = Math.floor(-DateTime.fromISO(iso).diffNow('years').years);
  return age >= MINIMUM_AGE && age <= MAXIMUM_AGE;
}

// modified from https://stackoverflow.com/a/50376498
export function isNumber(value: string): boolean {
  if (value.includes(' ')) {
    return false;
  }
  return value != null && value !== '' && !isNaN(Number(value.toString()));
}
