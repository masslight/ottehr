import { useEffect, useMemo } from 'react';
import { normalizeExamComment } from 'src/features/easy-chart/executor/examComment';
import { getRosFindingFieldKeys } from 'utils/lib/ottehr-config/review-of-systems';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { GetVitalsResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';
import { useChartSection } from '../../hooks/useChartSection';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import { useExamObservationsStore } from '../../stores/appointment/exam-observations.store';
import { useRosObservationsStore } from '../../stores/appointment/ros-observations.store';
import { useGetVitals } from '../vitals/hooks/useGetVitals';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { resolvedExamLeaf } from './scribeSections';
import { ScribeRecommendation } from './types';

/**
 * Whether the chart already holds what a recommendation would write.
 *
 * One predicate serves two jobs, so they cannot drift apart: the panel greys out a row that is
 * already charted, and the apply loop skips it rather than writing a duplicate. It covers three
 * cases with the same rule — the chart already had it before the transcript was read, a template
 * put it there, or the provider entered it by hand on one of the visit screens while the panel
 * was open.
 */

const normalize = (value: string | undefined): string => (value ?? '').trim().toLowerCase();

export interface ChartSnapshot {
  diagnosisCodes: Set<string>;
  /** Current allergies only; an inactive one does not count as charted. */
  allergyNames: Set<string>;
  /** Active medications only. */
  medicationNames: Set<string>;
  /** ROS fields recorded as true, keyed the way the ROS table keys them. */
  rosFields: Set<string>;
  /** Exam checkboxes ticked, by field — the leaf ids the exam catalogue resolves to. */
  examFields: Set<string>;
  /** Each exam card's free-text comment, by its field, where a finding with no checkbox is noted. */
  examComments: Map<string, string>;
  historyOfPresentIllness: string;
  hasWeight: boolean;
}

type ChartDataForSnapshot = Pick<GetChartDataResponse, 'diagnosis' | 'allergies' | 'medications'>;

export const buildChartSnapshot = ({
  chartData,
  rosObservations,
  examObservations,
  historyOfPresentIllness,
  vitals,
}: {
  chartData: Partial<ChartDataForSnapshot> | undefined;
  rosObservations: Record<string, ExamObservationDTO>;
  examObservations: Record<string, ExamObservationDTO>;
  historyOfPresentIllness: string | undefined;
  vitals: GetVitalsResponseData | undefined;
}): ChartSnapshot => ({
  diagnosisCodes: new Set((chartData?.diagnosis ?? []).map((diagnosis) => diagnosis.code)),
  allergyNames: new Set(
    (chartData?.allergies ?? []).filter((allergy) => allergy.current).map((allergy) => normalize(allergy.name))
  ),
  medicationNames: new Set(
    (chartData?.medications ?? [])
      .filter((medication) => medication.status === 'active')
      .map((medication) => normalize(medication.name))
  ),
  rosFields: new Set(
    Object.values(rosObservations)
      .filter((observation) => observation.value === true)
      .map((observation) => observation.field)
  ),
  examFields: new Set(
    Object.values(examObservations)
      .filter((observation) => observation.value === true)
      .map((observation) => observation.field)
  ),
  // The exam store holds the comment rows beside the ticks: an observation carrying `note` and no value.
  examComments: new Map(
    Object.values(examObservations)
      .filter((observation) => typeof observation.note === 'string' && observation.note.trim().length > 0)
      .map((observation) => [observation.field, (observation.note ?? '').trim()])
  ),
  historyOfPresentIllness: (historyOfPresentIllness ?? '').trim(),
  hasWeight: (vitals?.[VitalFieldNames.VitalWeight]?.length ?? 0) > 0,
});

export const isAlreadyCharted = (recommendation: ScribeRecommendation, snapshot: ChartSnapshot): boolean => {
  switch (recommendation.kind) {
    // Whether a template has been applied isn't something the chart records, so stage one tracks
    // that itself.
    case 'template':
      return false;
    case 'hpi':
      // Only the HPI itself is in the snapshot; another field's paragraph is settled by the apply, not by a look.
      return (
        (recommendation.field ?? 'historyOfPresentIllness') === 'historyOfPresentIllness' &&
        recommendation.text.trim().length > 0 &&
        snapshot.historyOfPresentIllness.includes(recommendation.text.trim())
      );
    case 'diagnosis':
      return snapshot.diagnosisCodes.has(recommendation.code);
    case 'allergy':
      return snapshot.allergyNames.has(normalize(recommendation.name));
    case 'medication':
      return snapshot.medicationNames.has(normalize(recommendation.name));
    case 'vital-weight':
      // Any weight on this encounter: a second one would be a correction, not this suggestion.
      return snapshot.hasWeight;
    case 'ros': {
      const { deniesKey, reportsKey } = getRosFindingFieldKeys(recommendation.baseKey);
      return snapshot.rosFields.has(recommendation.finding === RosFindingState.Reports ? reportsKey : deniesKey);
    }
    case 'exam': {
      // The box it will tick is on the chart, or the words it will note are already in that card's comment
      // — the same containment rule `writeExamComment` dedupes by. An ambiguity nobody has chosen on names
      // no box yet, so it is the executor's to judge.
      const leaf = resolvedExamLeaf(recommendation);
      if (leaf) return snapshot.examFields.has(leaf.field);
      const { resolution } = recommendation;
      if (resolution.kind !== 'none' || !resolution.commentField) return false;
      const note = snapshot.examComments.get(resolution.commentField);
      return note !== undefined && normalizeExamComment(note).includes(normalizeExamComment(recommendation.display));
    }
    // The executor checks its own duplicates as it runs and settles the step as skipped with the reason.
    case 'action':
      return false;
  }
};

/** The live chart, read from the same queries and stores the visit screens write to. */
export const useChartSnapshot = (): ChartSnapshot => {
  const { chartData } = useChartData();
  const { encounter } = useAppointmentData();
  // Subscribing to the whole ROS and exam stores is the point: ticking a box on the Review of Systems
  // or Examination screen has to show up here immediately.
  const rosObservations = useRosObservationsStore();
  const examObservations = useExamObservationsStore();
  // The HPI paragraph, from the encounter-notes section the HPI screen writes to (legacy tagging: it is
  // stored under the chief-complaint key).
  const { data: encounterNotes } = useChartSection('encounterNotes');
  const { data: vitals } = useGetVitals(encounter?.id);

  return useMemo(
    () =>
      buildChartSnapshot({
        chartData,
        rosObservations,
        examObservations,
        historyOfPresentIllness: encounterNotes?.chiefComplaint?.text,
        vitals,
      }),
    [chartData, rosObservations, examObservations, encounterNotes, vitals]
  );
};

/**
 * Keeps the panel store's list of already-charted recommendations in step with the chart, so the
 * rows, the counts and the apply loop all read the same answer.
 */
export const useSyncChartedRecommendations = (recommendations: ScribeRecommendation[]): void => {
  const snapshot = useChartSnapshot();
  const setChartedIds = useScribeRecommendationsStore((state) => state.setChartedIds);

  const chartedIds = useMemo(
    () => recommendations.filter((rec) => isAlreadyCharted(rec, snapshot)).map((rec) => rec.id),
    [recommendations, snapshot]
  );

  useEffect(() => {
    // The setter ignores an unchanged list, so this cannot cycle.
    setChartedIds(chartedIds);
  }, [chartedIds, setChartedIds]);
};
