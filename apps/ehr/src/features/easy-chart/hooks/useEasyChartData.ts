// The page's read layer — and it is NOT a read layer, it is two calls to the SHARED hook.
//
// The first implementation built a separate ~460-line read+write layer on the belief that
// `useChartData` required a populated appointment store. That belief was wrong: chart data lives in
// react-query, the cache key is [CHART_DATA_QUERY_KEY, encounterId, requestedFields], and the hook
// takes an encounterId directly. The three real gaps were fixed in the shared hooks themselves
// rather than routed around, so what is left here is a merge and nothing else.
//
// TWO QUERIES, ONE MEMOIZED SELECTOR. The page needs more than the default field set, and the cache
// key already includes requestedFields so several consumers coexist by design. Do not widen the
// app-wide default field set for one page's benefit, and do not spread the merge across components.
//
// The unscoped call is load-bearing: ONLY a request with requestedFields omitted returns `aiChat`,
// i.e. the transcripts this page is built around.

import { useCallback, useMemo } from 'react';
import { useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';

/**
 * Fields the default (unscoped) chart-data response does not carry, which this page needs: the
 * progress-note free-text fields, vitals, the disposition, the practice's note metadata and the
 * legacy addendum.
 */
const EXTRA_FIELDS = {
  chiefComplaint: { _tag: 'chief-complaint' },
  historyOfPresentIllness: { _tag: 'history-of-present-illness' },
  mechanismOfInjury: { _tag: 'mechanism-of-injury' },
  medicalDecision: { _tag: 'medical-decision' },
  accident: { _tag: 'accident' },
  vitalsObservations: {},
  disposition: {},
  ros: { _tag: 'ros' },
  // Past hospitalizations. get-chart-data fetches this ONLY when it is asked for — unlike conditions,
  // medications and surgical history, which the unscoped call brings by default. Omitting it does not
  // produce an error, it produces an empty section, which is why it was invisible.
  episodeOfCare: {},
  surgicalHistoryNote: {},
  notes: {},
  addendumNote: {},
  patientInfoConfirmed: {},
  prescribedMedications: {},
  // NOT requested. `inhouseMedications` is fetched PATIENT-scoped with a `_tag`, so it returns the
  // patient's in-house medication history across every visit — it showed a medication from a previous
  // encounter and omitted the one just given here. The note pane takes MAR orders from the
  // encounter-scoped get-medication-orders query instead, which is what Review & Sign does too.

  cptCodes: {},
  externalLabResults: {},
  inHouseLabResults: {},
  procedures: {},
  radiologyOrders: {},
  patientHasPreviousVisits: {},
  // Generated school / work excuses. Encounter-scoped DocumentReferences, fetched only when asked for.
  schoolWorkNotes: {},
} as const;

/**
 * Fields get-chart-data fetches ONLY on an explicit request, i.e. never from the unscoped call.
 * EXTRA_FIELDS must cover every one this page renders, or the section is silently empty rather than
 * erroring — the failure mode that hid hospitalizations. Pinned by a test.
 */
export const REQUEST_ONLY_CHART_FIELDS = [
  'accident',
  'birthHistory',
  'chiefComplaint',
  'cptCodes',
  'disposition',
  'episodeOfCare',
  'historyOfPresentIllness',
  'mechanismOfInjury',
  'medicalDecision',
  'notes',
  'practitioners',
  'preferredPharmacies',
  'prescribedMedications',
  'radiologyOrders',
  'ros',
  'surgicalHistoryNote',
  'vitalsObservations',
] as const;

/** Request-only fields this page deliberately does not ask for, with the reason. */
export const UNREQUESTED_BY_DESIGN: Record<string, string> = {
  birthHistory: 'not a visit-note section — it belongs to the patient record, not this encounter',
  practitioners: 'the note pane names no practitioners; the visit query already resolves the attender',
  preferredPharmacies: 'a prescribing concern, and prescriptions are transmitted from the regular chart',
};

export interface EasyChartData {
  chartData: GetChartDataResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
}

export function useEasyChartData(encounterId: string | undefined, enabled = true): EasyChartData {
  // Unscoped: the only call that returns aiChat (transcripts), plus the default set — diagnoses,
  // exam and ROS observations, allergies, conditions, medications, instructions, CPT/E&M.
  const base = useChartData({ encounterId, enabled: enabled && Boolean(encounterId) });

  const extra = useChartData({
    encounterId,
    enabled: enabled && Boolean(encounterId),
    requestedFields: EXTRA_FIELDS,
  });

  const chartData = useMemo<GetChartDataResponse | undefined>(() => {
    if (!base.chartData && !extra.chartData) return undefined;
    // Extra second so a narrowed query that actually asked for a field wins over the default
    // response's absence of it. Nothing here is deep-merged: each key belongs to exactly one query.
    return { ...(base.chartData ?? {}), ...(extra.chartData ?? {}) } as GetChartDataResponse;
  }, [base.chartData, extra.chartData]);

  const baseRefetch = base.refetch;
  const extraRefetch = extra.refetch;
  const refetch = useCallback(async (): Promise<void> => {
    await Promise.all([baseRefetch(), extraRefetch()]);
  }, [baseRefetch, extraRefetch]);

  return {
    chartData,
    isLoading: base.isLoading || extra.isLoading,
    isFetching: base.isFetching || extra.isFetching,
    refetch,
  };
}
