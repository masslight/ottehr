import { DateTime } from 'luxon';
import { MAX_APPOINTMENT_SEARCH_RANGE_DAYS } from '../types/constants';

/**
 * Validates the date range of an appointment search the way `get-appointments` accepts it: two ISO dates, the first
 * on or before the second, spanning at most MAX_APPOINTMENT_SEARCH_RANGE_DAYS. Returns the reason the range is
 * rejected, or undefined when it is valid. Shared by the zambda's validator and the tracking board's hook so the
 * client never issues a request the server would refuse.
 */
export const getAppointmentSearchDateRangeError = (
  searchDateFrom: string,
  searchDateTo: string
): string | undefined => {
  // Parse in a fixed zone so every day is exactly 24h; otherwise DST transitions in the process local zone
  // produce fractional-day diffs that make the limit nondeterministic at the boundary.
  const from = DateTime.fromISO(searchDateFrom, { zone: 'utc' });
  const to = DateTime.fromISO(searchDateTo, { zone: 'utc' });
  if (!from.isValid) return '"searchDateFrom" must be a valid date';
  if (!to.isValid) return '"searchDateTo" must be a valid date';
  if (from > to) return '"searchDateFrom" must be on or before "searchDateTo"';
  if (to.diff(from, 'days').days > MAX_APPOINTMENT_SEARCH_RANGE_DAYS) {
    return `The date range must not exceed ${MAX_APPOINTMENT_SEARCH_RANGE_DAYS} days`;
  }
  return undefined;
};
