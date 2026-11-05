import { DateTime } from 'luxon';
import { TIMEZONES } from '../../types/constants';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// The practice-local day (yyyy-MM-dd) a patient payment belongs to. A manual paymentDate is already
// the practice's local day; a timestamp (e.g. a Stripe charge) is placed on the day it fell in there.
export const paymentDayOf = (iso: string): string =>
  DATE_ONLY.test(iso) ? iso : DateTime.fromISO(iso).setZone(TIMEZONES[0]).toISODate() ?? iso;
