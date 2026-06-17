/**
 * Transient hand-off from an existing report into the Ad-Hoc Report page ("Customize"). A report
 * stashes its SEARCH CRITERIA (which dataset + which date range) here and navigates to
 * /reports/ad-hoc; the ad-hoc page consumes the criteria on mount, sets its dataset + date controls
 * to match, and fetches LIVE. The controls stay visible and adjustable, so the user can change the
 * range and re-fetch — i.e. it's the same dataset/date the report used, not a frozen snapshot.
 *
 * Module-level (not a store/context) on purpose: a one-shot baton handed across a single navigation,
 * read once. clear() resets it so a later plain visit to /reports/ad-hoc starts blank, and a refresh
 * (which loses module state) correctly falls back to the normal flow.
 */
export interface AdHocCriteria {
  /** Dataset id to pre-select (must be a registered AD_HOC_DATASETS id). */
  datasetId: string;
  /** Date-range selector value (the ad-hoc page's DateRangeFilter), e.g. "today", "last-30-days". */
  dateRange: string;
  customDate?: string;
  customStartDate?: string;
  customEndDate?: string;
  /** Short provenance for the banner, e.g. "Recent Patients · Last 7 days". */
  sourceLabel?: string;
}

let pending: AdHocCriteria | null = null;

export function setAdHocCriteria(criteria: AdHocCriteria): void {
  pending = criteria;
}

/**
 * Read the pending criteria WITHOUT clearing it. Pure, so it's safe to call from a render / useState
 * initializer (StrictMode double-invokes in dev); capture it, then call clearAdHocCriteria() from an
 * effect so a later plain visit starts fresh.
 */
export function peekAdHocCriteria(): AdHocCriteria | null {
  return pending;
}

export function clearAdHocCriteria(): void {
  pending = null;
}
