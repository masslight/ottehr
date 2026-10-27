import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsWeightObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useGetHistoricalVitals, useGetVitals } from '../../../shared/components/vitals/hooks/useGetVitals';
import { useAppointmentData } from '../../../shared/stores/appointment/appointment.store';

/** The weight the dose calculator starts from, in kg as the vitals keep it. */
export interface VisitWeight {
  kg: number;
  /** When it was recorded, ISO. */
  takenAt?: string;
  /** Recorded at this visit, rather than the most recent earlier one. */
  thisVisit: boolean;
}

/** The most recent weight with a value; a refused weight has none. */
const latestWeight = (observations: VitalsWeightObservationDTO[] | undefined): VisitWeight | undefined => {
  const latest = observations
    ?.filter((obs) => 'value' in obs && typeof obs.value === 'number')
    .sort((a, b) => (b.lastUpdated ?? '').localeCompare(a.lastUpdated ?? ''))[0];
  return latest?.value === undefined ? undefined : { kg: latest.value, takenAt: latest.lastUpdated, thisVisit: true };
};

/** This visit's latest weight, else the latest from an earlier visit, as the vitals endpoints the Vitals page
 * and the eRx readiness check already read (the same query keys, so nothing is fetched twice). */
export const useVisitWeight = (): VisitWeight | undefined => {
  const { encounter } = useAppointmentData();
  const { data: current } = useGetVitals(encounter?.id);
  const { data: historical } = useGetHistoricalVitals(encounter?.id);
  const own = latestWeight(current?.[VitalFieldNames.VitalWeight]);
  if (own) return own;
  const previous = latestWeight(historical?.[VitalFieldNames.VitalWeight]);
  return previous && { ...previous, thisVisit: false };
};
