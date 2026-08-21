// The page's read layer — two SHARED-hook calls, split by what each one is actually for.
//
// The first implementation built a separate ~460-line read+write layer on the belief that
// `useChartData` required a populated appointment store. That belief was wrong: chart data lives in
// react-query, the cache key is [CHART_DATA_QUERY_KEY, encounterId, requestedFields], and the hook
// takes an encounterId directly. The three real gaps were fixed in the shared hooks themselves
// rather than routed around, so what is left here is a merge and nothing else.
//
// THE NOTE FIELDS COME FROM useChartFields, NOT useChartData. This page used to run useChartData twice
// — once unscoped, once with requestedFields — and merge the two responses. It looked equivalent and was
// not: useChartData carries a five-minute staleTime, so after the assistant wrote a note field react-query
// considered the old value fresh, and the merge (scoped second, unconditionally) let that stale value mask
// the new one. The symptom was a chart that only updated on a page reload, which is exactly what it looks
// like from the outside: the write worked, the refetch returned the new text, and the note stayed empty.
//
// useChartFields is the hook the rest of the app already uses for a named field set — Review & Sign reads
// the same fields through it. staleTime is 0 there, and it trims its response to exactly the fields asked
// for, so a field it owns cannot be shadowed by a second query's older copy.
//
// The unscoped useChartData call stays, for ONE reason: only a request with requestedFields omitted
// returns `aiChat`, i.e. the transcripts this page is built around.

import { useCallback, useMemo } from 'react';
import { useGetVitals } from 'src/features/visits/shared/components/vitals/hooks/useGetVitals';
import { useChartFields } from 'src/features/visits/shared/hooks/useChartFields';
import { useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { GetVitalsResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';

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
  // NOT vitalsObservations. The Vitals section renders the get-vitals response instead, which is the only
  // source that carries the criticality flags — see the `vitals` field on EasyChartData.
  // TAGGED, and it has to be. get-chart-data resolves `disposition` and `radiologyOrders` by searching
  // ServiceRequest, and it attributes every ServiceRequest the batch returns to `procedures`. Asking for
  // either one WITHOUT a tag searches every ServiceRequest on the encounter — which includes the procedure
  // — so the same procedure came back once per untagged search and the note rendered three identical
  // procedure cards. Review & Sign never had that because it passes these tags. Kept byte-identical to
  // progressNoteChartDataRequestedFields, and pinned by a test so the two cannot drift.
  disposition: { _tag: 'disposition-follow-up,sub-follow-up' },
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
  // _revinclude pulls in the result files for orders that have no DiagnosticReport — same as the note.
  radiologyOrders: {
    _tag: 'radiology',
    // Widened out of the surrounding `as const`: SearchParams wants a mutable array.
    _revinclude: ['DiagnosticReport:based-on', 'DocumentReference:related'] as string[],
  },
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
  vitalsObservations:
    'the Vitals section renders the get-vitals response instead — the only source that stamps alertCriticality ' +
    'on each reading, which is what colours an out-of-range value and puts a warning icon beside it',
};

export interface EasyChartData {
  chartData: GetChartDataResponse | undefined;
  /**
   * Vitals from the get-vitals endpoint, NOT from `chartData.vitalsObservations`.
   *
   * They are not the same readings rendered twice: only get-vitals stamps `alertCriticality` on each
   * observation (see getVitalDTOCriticalityFromObservation), which is what colours an out-of-range reading red
   * or amber and puts the warning icon beside it. get-chart-data returns the values with no criticality at
   * all, so a note built from those prints a critical temperature in plain black — the one thing about a vital
   * that a provider must not have to work out for themselves.
   */
  vitals: GetVitalsResponseData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
}

export function useEasyChartData(encounterId: string | undefined, enabled = true): EasyChartData {
  // Unscoped: the only call that returns aiChat (transcripts), plus the default set — diagnoses, exam and
  // ROS observations, allergies, conditions, medications, instructions, CPT/E&M.
  //
  // NO `shouldUpdateExams` here, deliberately. That flag populates the exam and ROS observation STORES,
  // which is a different thing from returning the data: the hosted ExamTab and RosTab render a spinner
  // until their initialisation stores say they have data. This page used to set it because it lived at its
  // own /easy-chart/:encounterId route, outside the chart layout. As a tab of the in-person chart it gets
  // that from InPersonLayout, which sets the flag once for the whole route — and since the encounter id is
  // read the same way, both calls land on ONE react-query entry rather than two.
  const base = useChartData({
    encounterId,
    enabled: enabled && Boolean(encounterId),
  });

  // Request-only fields, through the app's field-set hook. Its response is trimmed to exactly these keys.
  const fields = useChartFields({
    encounterId,
    requestedFields: EXTRA_FIELDS,
    enabled: enabled && Boolean(encounterId),
  });

  // Vitals, for the criticality flags — see the `vitals` field on EasyChartData.
  const vitals = useGetVitals(enabled ? encounterId : undefined);

  const chartData = useMemo<GetChartDataResponse | undefined>(() => {
    if (!base.chartData && !fields.data) return undefined;
    // Scoped second: it is the authoritative source for every key it carries, and unlike the previous
    // arrangement it cannot be serving a stale copy — see the header.
    return { ...(base.chartData ?? {}), ...(fields.data ?? {}) } as GetChartDataResponse;
  }, [base.chartData, fields.data]);

  const baseRefetch = base.refetch;
  const fieldsRefetch = fields.refetch;
  const vitalsRefetch = vitals.refetch;
  // All three, so every caller of `refetch` refreshes the whole note. Leaving vitals out of here is how the
  // assistant charts a reading and the section stays a step behind until a reload.
  const refetch = useCallback(async (): Promise<void> => {
    await Promise.all([baseRefetch(), fieldsRefetch(), vitalsRefetch()]);
  }, [baseRefetch, fieldsRefetch, vitalsRefetch]);

  return {
    chartData,
    vitals: vitals.data,
    isLoading: base.isLoading || fields.isLoading,
    isFetching: base.isFetching || fields.isFetching,
    refetch,
  };
}
