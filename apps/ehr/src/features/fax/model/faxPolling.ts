import { FaxPacketSource } from 'utils/lib/types/api/fax.types';
import { actionLogsQueryKey } from '../../action-logs/actionLogs.constants';

/**
 * Cadence for polling the fax-packet Task status.
 *
 * The first poll fires immediately; each entry below is the delay before the next poll. The schedule backs
 * off quickly at first (3s → 6s → 12s) to catch fast jobs, then settles at a steady 30s so a slow job never
 * hammers the status endpoint. React Query dedupes by task id and pauses this interval while the tab is
 * unfocused, so concurrent sends stay cheap without any extra machinery.
 *
 * Total ≈ 5.85 min (3 + 6 + 12 + 11 × 30), which comfortably covers the subscription's worst-case runtime.
 */
export const FAX_STATUS_POLL_INTERVALS_MS: number[] = [3000, 6000, 12000, ...Array<number>(11).fill(30000)];

/** Grace added on top of the schedule so the timeout timer never beats the final in-flight poll. */
const FAX_STATUS_POLL_TIMEOUT_GRACE_MS = 5000;

/**
 * Hard ceiling for the whole poll. Once this elapses without a terminal result we stop polling and tell the
 * user we couldn't confirm the outcome. Derived from the schedule so the two can never drift apart.
 */
export const FAX_STATUS_POLL_TIMEOUT_MS =
  FAX_STATUS_POLL_INTERVALS_MS.reduce((sum, ms) => sum + ms, 0) + FAX_STATUS_POLL_TIMEOUT_GRACE_MS;

/**
 * Delay before the next poll given how many polls have already completed, or `false` to stop.
 * `completedPolls` is React Query's `dataUpdateCount`: 1 after the first successful fetch, so the delay
 * before poll N+1 is `FAX_STATUS_POLL_INTERVALS_MS[N - 1]`.
 */
export const nextFaxPollInterval = (completedPolls: number): number | false =>
  FAX_STATUS_POLL_INTERVALS_MS[completedPolls - 1] ?? false;

export const faxHistoryQueryKey = (source: FaxPacketSource): readonly unknown[] =>
  source.type === 'visit'
    ? ['get-visit-fax-history', source.appointmentId]
    : actionLogsQueryKey('fax', source.patientId);

export const faxStatusTimeoutMessage = (source: FaxPacketSource): string =>
  source.type === 'visit'
    ? "We couldn't confirm whether the fax was sent. Check the visit's fax history before resending."
    : "We couldn't confirm whether the fax was sent. Check the patient's fax history before resending.";
