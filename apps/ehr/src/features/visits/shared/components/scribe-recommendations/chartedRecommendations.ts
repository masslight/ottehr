import { useEffect, useMemo } from 'react';
import { getRosFindingFieldKeys } from 'utils/lib/ottehr-config/review-of-systems';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { GetVitalsResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';
import { useChartFields } from '../../hooks/useChartFields';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import { useRosObservationsStore } from '../../stores/appointment/ros-observations.store';
import { useGetVitals } from '../vitals/hooks/useGetVitals';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
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
  historyOfPresentIllness: string;
  hasWeight: boolean;
}

type ChartDataForSnapshot = Pick<GetChartDataResponse, 'diagnosis' | 'allergies' | 'medications'>;

export const buildChartSnapshot = ({
  chartData,
  rosObservations,
  historyOfPresentIllness,
  vitals,
}: {
  chartData: Partial<ChartDataForSnapshot> | undefined;
  rosObservations: Record<string, ExamObservationDTO>;
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
      return (
        recommendation.text.trim().length > 0 && snapshot.historyOfPresentIllness.includes(recommendation.text.trim())
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
  }
};

/** The live chart, read from the same queries and stores the visit screens write to. */
export const useChartSnapshot = (): ChartSnapshot => {
  const { chartData } = useChartData();
  const { encounter } = useAppointmentData();
  // Subscribing to the whole ROS store is the point: ticking a box on the Review of Systems
  // screen has to show up here immediately.
  const rosObservations = useRosObservationsStore();
  const { data: hpiFields } = useChartFields({ requestedFields: { chiefComplaint: { _tag: 'chief-complaint' } } });
  const { data: vitals } = useGetVitals(encounter?.id);

  return useMemo(
    () =>
      buildChartSnapshot({
        chartData,
        rosObservations,
        historyOfPresentIllness: hpiFields?.chiefComplaint?.text,
        vitals,
      }),
    [chartData, rosObservations, hpiFields, vitals]
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
