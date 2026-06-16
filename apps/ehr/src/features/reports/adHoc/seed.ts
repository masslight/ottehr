import { AdHocRow, DatasetSchema } from './types';

/**
 * Transient handoff from an existing report into the Ad-Hoc Report page. A report packages its
 * already-fetched rows + a derived schema, stashes them here, and navigates to /reports/ad-hoc;
 * the ad-hoc page consumes the seed on mount and skips its own dataset/date/fetch step.
 *
 * Module-level (not a store/context) on purpose: it's a one-shot baton handed across a single
 * navigation, read exactly once. consume() clears it so a later plain visit to /reports/ad-hoc
 * starts fresh, and a refresh (which loses module state) correctly falls back to the normal flow.
 * Rows stay client-side throughout — the privacy model (only schema reaches the LLM) is unchanged.
 */
export interface AdHocSeed {
  rows: AdHocRow[];
  schema: DatasetSchema;
  /** Short provenance shown in the seeded banner, e.g. "Practice KPIs · Last 7 days". */
  sourceLabel: string;
}

let pending: AdHocSeed | null = null;

export function setAdHocSeed(seed: AdHocSeed): void {
  pending = seed;
}

/**
 * Read the pending seed WITHOUT clearing it. Pure, so it's safe to call from a render / useState
 * initializer (which React StrictMode double-invokes in dev) — capture it into state, then call
 * clearAdHocSeed() from an effect so a later plain visit starts fresh.
 */
export function peekAdHocSeed(): AdHocSeed | null {
  return pending;
}

export function clearAdHocSeed(): void {
  pending = null;
}
