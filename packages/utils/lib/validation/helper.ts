import { DateTime } from 'luxon';
import { isoStringFromMDYString } from '../utils';

export function ageIsInRange(dateOfBirth: string, min: number, max: number): boolean {
  // make sure string is in iso format
  const iso = isoStringFromMDYString(dateOfBirth);
  const age = Math.floor(-DateTime.fromISO(iso).diffNow('years').years);
  return age >= min && age <= max;
}
