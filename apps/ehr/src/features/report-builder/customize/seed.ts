/**
 * Transient hand-off from a report into the Ad-Hoc page ("Customize"): stashes SEARCH CRITERIA
 * (dataset + date range), navigates to /reports/ad-hoc; that page reads it on mount, matches its
 * dataset/date controls, and fetches LIVE. Controls stay adjustable — same dataset/date, not a
 * frozen snapshot.
 *
 * Module-level (not a store/context) on purpose: a one-shot baton read once across a single
 * navigation. clear() resets it so a later plain visit starts blank; a refresh loses module state
 * and falls back to the normal flow.
 */
export interface AdHocCriteria {
  /** Dataset id to pre-select (must be a registered AD_HOC_DATASETS id). */
  datasetId: string;
  /** Date-range selector value (the ad-hoc page's DateRangeFilter), e.g. "today", "last-30-days". */
  dateRange: string;
  customDate?: string;
  customStartDate?: string;
  customEndDate?: string;
  /** Selected dataset opt-in layers (checkbox state), keyed by option id. */
  options?: Record<string, boolean>;
  /** Short provenance for the banner, e.g. "Recent Patients · Last 7 days". */
  sourceLabel?: string;
}

let pending: AdHocCriteria | null = null;

export function setAdHocCriteria(criteria: AdHocCriteria): void {
  pending = criteria;
}

/**
 * Read pending criteria WITHOUT clearing — pure, so safe in a render / useState initializer
 * (StrictMode double-invokes in dev). Capture it, then clearAdHocCriteria() from an effect so a
 * later plain visit starts fresh.
 */
export function peekAdHocCriteria(): AdHocCriteria | null {
  return pending;
}

export function clearAdHocCriteria(): void {
  pending = null;
}
