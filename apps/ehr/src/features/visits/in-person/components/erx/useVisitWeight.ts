import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PrescriptionAllergy } from 'utils/lib/types/api/order-prescription.types';
import { useGetAllPatientVitals, useGetVitals } from '../../../shared/components/vitals/hooks/useGetVitals';
import { useVisitNote } from '../../../shared/hooks/useVisitNote';
import { useAppointmentData } from '../../../shared/stores/appointment/appointment.store';
import { prescriptionAllergies } from './prescriptionLines';

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

/** The patient's latest value of a vital from any visit, with when it was taken: the most recent is what the
 * pharmacy is asked for. It reads the vitals endpoint the Vitals page uses; "thisVisit" says whether that latest value
 * is the visit's own (the visit is the page's, unless another one is given). */
const useVisitVital = (
  field: VitalFieldNames.VitalWeight | VitalFieldNames.VitalHeight,
  encounterId?: string
): LatestVital | undefined => {
  const { encounter } = useAppointmentData();
  const { data: current } = useGetVitals(encounterId ?? encounter?.id);
  const { data: all } = useGetAllPatientVitals(encounterId ?? encounter?.id);
  const latest = latestVital(all?.[field]);
  const own = latestVital(current?.[field]);
  if (!latest) return own;
  return { ...latest, thisVisit: !!own && own.takenAt === latest.takenAt && own.value === latest.value };
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

/** The patient's active allergies sent with an order, an answer to a request or a cancel, as the order form's
 * Allergies list reads them (the same query, so nothing is fetched twice). The visit is the page's, unless another one
 * is given. */
export const useVisitAllergies = (encounterId?: string): PrescriptionAllergy[] | undefined => {
  const { data: note } = useVisitNote(encounterId ? { encounterId } : {});
  return prescriptionAllergies(note?.history.allergies);
};
