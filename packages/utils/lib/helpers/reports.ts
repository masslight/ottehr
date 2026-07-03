import { DateTime } from 'luxon';

/**
 * The default number of days per batch when splitting date ranges
 * to prevent backend responses from exceeding size limits
 */
export const DEFAULT_BATCH_DAYS = 1;

/**
 * Batch size for the ad-hoc reporting datasets. Their zambdas (adhoc-encounters / -patients /
 * -billing) paginate internally and pull heavy layers in their own chunked sub-queries, so they
 * handle a multi-day window in one call comfortably. Using 1-day batches here meant a 4-month report
 * fired ~120 requests; 7-day batches cut that ~7x while staying well under the response-size cap.
 */
export const ADHOC_BATCH_DAYS = 7;

/**
 * Splits a date range into batches of maximum days each.
 * This is useful for preventing backend API responses from exceeding size limits
 * by breaking large date ranges into smaller chunks.
 *
 * @param start - ISO date string for the start of the range
 * @param end - ISO date string for the end of the range
 * @param maxDays - Maximum number of days per batch (default: 5)
 * @returns Array of date range objects with start and end ISO strings
 *
 * @example
 * // Split a 30-day range into 5-day batches
 * const batches = splitDateRangeIntoBatches('2025-01-01T00:00:00Z', '2025-01-31T23:59:59Z');
 * // Returns 6 batches: [5 days, 5 days, 5 days, 5 days, 5 days, 5 days]
 */
export function splitDateRangeIntoBatches(
  start: string,
  end: string,
  maxDays: number = DEFAULT_BATCH_DAYS
): Array<{ start: string; end: string }> {
  const startDate = DateTime.fromISO(start);
  const endDate = DateTime.fromISO(end);

  const batches: Array<{ start: string; end: string }> = [];
  let currentStart = startDate;

  while (currentStart < endDate) {
    const currentEnd = DateTime.min(currentStart.plus({ days: maxDays }).minus({ milliseconds: 1 }), endDate);

    batches.push({
      start: currentStart.toISO() ?? '',
      end: currentEnd.toISO() ?? '',
    });

    currentStart = currentEnd.plus({ milliseconds: 1 });
  }

  return batches;
}
