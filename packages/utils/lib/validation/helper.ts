import { DateTime } from 'luxon';

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
    case 'policy-holder-zip':
    case 'policy-holder-zip-2':
    case 'weight':
      return 'number';
    case 'patient-number':
    case 'guardian-number':
    case 'pcp-number':
    case 'pharmacy-phone':
    case 'responsible-party-number':
    case 'person-accompanying-minor-phone-number':
    case 'invite-phone':
    case 'phoneNumber':
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
