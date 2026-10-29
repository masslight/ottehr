import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
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

type LatestVital = Omit<VisitWeight, 'kg'> & { value: number };

/** The most recent observation with a value; a refused weight has none. */
const latestVital = (observations: { value?: number; lastUpdated?: string }[] | undefined): LatestVital | undefined => {
  const latest = observations
    ?.filter((obs) => typeof obs.value === 'number')
    .sort((a, b) => (b.lastUpdated ?? '').localeCompare(a.lastUpdated ?? ''))[0];
  return latest?.value === undefined
    ? undefined
    : { value: latest.value, takenAt: latest.lastUpdated, thisVisit: true };
};

/** This visit's latest value of a vital, else the latest from an earlier visit, as the vitals endpoints the Vitals
 * page and the eRx readiness check already read (the same query keys, so nothing is fetched twice). The visit is the
 * page's, unless another one is given. */
const useVisitVital = (
  field: VitalFieldNames.VitalWeight | VitalFieldNames.VitalHeight,
  encounterId?: string
): LatestVital | undefined => {
  const { encounter } = useAppointmentData();
  const { data: current } = useGetVitals(encounterId ?? encounter?.id);
  const { data: historical } = useGetHistoricalVitals(encounterId ?? encounter?.id);
  const own = latestVital(current?.[field]);
  if (own) return own;
  const previous = latestVital(historical?.[field]);
  return previous && { ...previous, thisVisit: false };
};

export const useVisitWeight = (encounterId?: string): VisitWeight | undefined => {
  const vital = useVisitVital(VitalFieldNames.VitalWeight, encounterId);
  return vital && { kg: vital.value, takenAt: vital.takenAt, thisVisit: vital.thisVisit };
};

/** The height sent with an order, in cm as the vitals keep it. */
export const useVisitHeight = (encounterId?: string): { cm: number; takenAt?: string } | undefined => {
  const vital = useVisitVital(VitalFieldNames.VitalHeight, encounterId);
  return vital && { cm: vital.value, takenAt: vital.takenAt };
};
