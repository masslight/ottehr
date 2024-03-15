import { DateTime } from 'luxon';
import { isoStringFromMDYString } from '../utils';

export function ageIsInRange(dateOfBirth: string, min: number, max: number): boolean {
  // make sure string is in iso format
  const iso = isoStringFromMDYString(dateOfBirth);
  const age = Math.floor(-DateTime.fromISO(iso).diffNow('years').years);
  return age >= min && age <= max;
}

// modified from https://stackoverflow.com/a/50376498
export function isNumber(value: string): boolean {
  if (value.includes(' ')) {
    return false;
  }
  return value != null && value !== '' && !isNaN(Number(value.toString()));
}

// all types on input here:
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
