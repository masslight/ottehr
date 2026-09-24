// The assistant's read layer: the visit note, as one whole-chart object.
//
// WHAT IT IS FOR, now that the assistant is a widget and renders no note of its own: `buildChartSnapshot`
// turns this into the executor's view of what is ALREADY on the chart, and that view is what stops the
// model re-charting an item every turn and what the procedure write diffs against. So the read is
// deliberately the whole chart — a section missing from here is a section the assistant believes is empty.
//
// ONE READ. This used to be two get-chart-data calls merged — the default set, then the fields that endpoint
// fetched only when named — with a staleness trap in the merge and a field list to keep in step with the
// zambda. The chart is read through get-visit-note now: every section plus the vitals, lab results,
// radiology orders and participants in one call, seeded into one cache entry per section that every screen
// of the visit reads and writes (see chartSectionCache). `useVisitNote` assembles the note live from those
// entries, so a row the provider adds on a visit screen shows up here without another request, and
// `wholeChartFromVisitNote` folds it into the `GetChartDataResponse` shape the executor, the chart-state
// summary and the note-field context are written against — the same fold the plan and review endpoints
// make server-side, so the assistant and its prompts describe one chart.

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useGetVitals } from 'src/features/visits/shared/components/vitals/hooks/useGetVitals';
import { readVisitNoteFromCache } from 'src/features/visits/shared/hooks/legacyChartData';
import { useVisitNote } from 'src/features/visits/shared/hooks/useVisitNote';
import { wholeChartFromVisitNote } from 'utils/lib/easy-chart/visit-note-chart';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { GetVitalsResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';

export interface EasyChartData {
  chartData: GetChartDataResponse | undefined;
  /**
   * Vitals from the get-vitals endpoint, NOT from `chartData.vitalsObservations`.
   *
   * They are not the same readings rendered twice: only get-vitals stamps `alertCriticality` on each
   * observation (see getVitalDTOCriticalityFromObservation), which is what colours an out-of-range reading red
   * or amber and puts the warning icon beside it. The visit note returns the values with no criticality at
   * all, so a note built from those prints a critical temperature in plain black — the one thing about a vital
   * that a provider must not have to work out for themselves.
   */
  vitals: GetVitalsResponseData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  /**
   * Re-read the visit note and the vitals, AND hand back the result.
   *
   * Returning it is not a convenience. A caller that has to act on what a write produced — the
   * post-template reconciliation is the one that does — cannot read it off `chartData`, because that
   * binding belongs to the render it was captured in and the refresh has not re-rendered anything yet.
   * Waiting a tick for the re-render is the other way, and it is a race with no upper bound. The value
   * is read straight out of the cache entries the refetch just seeded, so it is exactly what the next
   * render will see.
   */
  refetch: () => Promise<GetChartDataResponse | undefined>;
}

export function useEasyChartData(encounterId: string | undefined, enabled = true): EasyChartData {
  // The explicit id is authoritative for `useVisitNote`: with none, nothing is read. The callers all have
  // the encounter in hand, and the appointment store may not be populated where the assistant is mounted.
  //
  // No refetch on mount, deliberately. A screen change marks the note stale and the screens refresh the
  // sections they show; a whole-chart reader lives off those refreshes plus the explicit `refetch` after
  // its own writes — the same arrangement as the layout's whole-chart read, and both land on the same
  // cache entries, so the two cost one visit-note read between them.
  const note = useVisitNote({ encounterId, enabled: enabled && Boolean(encounterId), refetchOnMount: false });

  // Vitals, for the criticality flags — see the `vitals` field on EasyChartData.
  const vitals = useGetVitals(enabled ? encounterId : undefined);

  const chartData = useMemo(
    (): GetChartDataResponse | undefined => (note.data ? wholeChartFromVisitNote(note.data) : undefined),
    [note.data]
  );

  const noteRefetch = note.refetch;
  const vitalsRefetch = vitals.refetch;
  const queryClient = useQueryClient();
  // Both, so every caller of `refetch` refreshes the whole note. Leaving vitals out of here is how the
  // assistant charts a reading and the section stays a step behind until a reload.
  const refetch = useCallback(async (): Promise<GetChartDataResponse | undefined> => {
    await Promise.all([noteRefetch(), vitalsRefetch()]);
    const fresh = encounterId ? readVisitNoteFromCache(queryClient, encounterId) : undefined;
    return fresh ? wholeChartFromVisitNote(fresh) : undefined;
  }, [noteRefetch, vitalsRefetch, queryClient, encounterId]);

  return {
    chartData,
    vitals: vitals.data,
    isLoading: note.isLoading,
    isFetching: note.isFetching,
    refetch,
  };
}
