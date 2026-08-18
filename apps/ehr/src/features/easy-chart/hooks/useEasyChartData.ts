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

import { useMemo } from 'react';
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
  notes: {},
  addendumNote: {},
  patientInfoConfirmed: {},
  prescribedMedications: {},
  inhouseMedications: {},
  externalLabResults: {},
  inHouseLabResults: {},
  procedures: {},
  radiologyOrders: {},
  patientHasPreviousVisits: {},
} as const;

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
