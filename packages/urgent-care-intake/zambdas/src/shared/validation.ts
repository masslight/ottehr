import { DateTime } from 'luxon';

export const MINIMUM_AGE = 0;
export const MAXIMUM_AGE = 26;
export const MAXIMUM_CHARACTER_LIMIT = 160;
export const alphanumericRegex = /^[a-zA-Z0-9]+/;
export const emailRegex = /^\S+@\S+\.\S+$/;
export const zipRegex = /^\d{5}$/;
export const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Phone number regex
// ^(\+1)? match an optional +1 at the beginning of the string
// \d{10}$ match exactly 10 digits at the end of the string
export const phoneRegex = /^(\+1)?\d{10}$/;

export function ageIsInRange(dateOfBirth: string): boolean {
  const age = Math.floor(-DateTime.fromISO(dateOfBirth).diffNow('years').years);
  return age >= MINIMUM_AGE && age <= MAXIMUM_AGE;
}
