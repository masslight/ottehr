import { DateTime } from 'luxon';

export const MINIMUM_AGE = 0;
export const MAXIMUM_AGE = 26;
export const alphanumericRegex = /^[a-zA-Z0-9]+/;
export const emailRegex = /^\S+@\S+\.\S+$/;
export const stateRegex = /^[A-Za-z]{2}$/;
export const zipRegex = /^\d{5}$/;
export const phoneRegex = /^\d{10}$/;

export function ageIsInRange(dateOfBirth: string): boolean {
  const age = Math.floor(-DateTime.fromISO(dateOfBirth).diffNow('years').years);
  return age >= MINIMUM_AGE && age <= MAXIMUM_AGE;
}
