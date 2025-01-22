import { DateTime } from 'luxon';
import { isoStringFromMDYString } from '../utils';

export interface AgeCheckResult {
  result: boolean;
  notYetBorn: boolean;
  tooOld: boolean;
}
export function ageIsInRange(dateOfBirth: string, min: number, max: number): AgeCheckResult {
  // make sure string is in iso format
  const iso = isoStringFromMDYString(dateOfBirth);
  const age = Math.floor(-DateTime.fromISO(iso).diffNow('years').years);
  const isBorn = age >= min;
  const notTooOld = age <= max;

  return {
    result: isBorn && notTooOld,
    notYetBorn: !isBorn,
    tooOld: !notTooOld,
  };
}

// modified from https://stackoverflow.com/a/50376498
export function isNumber(value: string): boolean {
  if (value.includes(' ')) {
    return false;
  }
  return value != null && value !== '' && !isNaN(Number(value.toString()));
}

// all types on input as seen here:
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#Form_%3Cinput%3E_types
export const getInputTypes = (name: string): string => {
  switch (name) {
    case 'patient-zip':
      return 'number';
    case 'patient-number':
    case 'guardian-number':
    case 'pcp-number':
    case 'pharmacy-phone':
    case 'responsible-party-number':
      return 'tel';
    default:
      return 'text';
  }
};

export function isOlderThan18Years(dateString: string): boolean {
  const inputDate = DateTime.fromISO(dateString);

  const yearsDifference = DateTime.now().diff(inputDate, 'years').years;

  return yearsDifference > 18;
}

export function isNullOrUndefined(value: any): boolean {
  return value === undefined || value === null;
}
