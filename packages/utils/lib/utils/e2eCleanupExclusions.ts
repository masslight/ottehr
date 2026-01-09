/**
 * Cutoff date for cleanup. Resources with lastUpdated < this date will be PROTECTED.
 * Resources with lastUpdated >= this date will be DELETED.
 *
 * Use case: Set to the time when you created resources for investigation.
 * This protects old investigation resources while cleaning up newer accumulated test resources.
 *
 * @example
 * // You created investigation resources on Nov 6 at 15:34:13, then set:
 * export const CLEANUP_CUTOFF_DATE = '2025-11-06T15:34:13.496Z';
 * // Result: resources before this date+time are protected, after are deleted
 */
export const CLEANUP_CUTOFF_DATE: string | null = '2026-01-08T17:20:41.080Z';
