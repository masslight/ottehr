import { isAnnotationFollowupEncounter } from 'utils/lib/fhir/encounter';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { is18YearsOrYounger } from 'utils/lib/validation/helper';
import { useGetHistoricalVitals, useGetVitals } from '../components/vitals/hooks/useGetVitals';
import { useAppointmentData } from '../stores/appointment/appointment.store';

const hasValidHeight = (observations?: VitalsObservationDTO[]): boolean =>
  observations?.some(
    (obs) => obs.field === VitalFieldNames.VitalHeight && 'value' in obs && typeof obs.value === 'number'
  ) ?? false;

const hasValidWeight = (observations?: VitalsObservationDTO[]): boolean =>
  observations?.some((obs) => {
    if (obs.field !== VitalFieldNames.VitalWeight) return false;

    if ('value' in obs && typeof obs.value === 'number') {
      return true;
    }

    return 'extraWeightOptions' in obs && obs.extraWeightOptions?.includes('patient_refused');
  }) ?? false;

const MISSING_VITALS_MESSAGE =
  "Patient doesn't have height or weight vital specified. Please specify it first on the `Vitals` tab";

/**
 * Shared eRx patient-vitals readiness used by both the full prescriber flow (<ERX>) and the
 * lightweight interaction-only flow (<ERXInteractionsReadiness>).
 *
 * The upstream eRx provider (DoseSpot) requires height/weight for patients 18 and under before
 * a patient can be synced, so both flows need to know whether those vitals are present. A value from
 * any of the patient's visits counts, so this reads this visit's vitals and the historical ones.
 */
export const useErxPatientVitals = (): {
  hasVitals: boolean;
  isVitalsLoading: boolean;
  isVitalsFetched: boolean;
  missingVitalsMessage: string;
} => {
  const { patient, encounter, followUpOriginEncounter } = useAppointmentData();

  // Annotation follow-ups have no Vitals tab; their height/weight is the one recorded on the visit they annotate.
  const isAnnotationFollowup = Boolean(encounter && isAnnotationFollowupEncounter(encounter));
  const vitalsEncounterId = isAnnotationFollowup ? followUpOriginEncounter?.id : encounter?.id;

  const {
    data: currentVitals,
    isLoading: isCurrentLoading,
    isFetched: isCurrentFetched,
  } = useGetVitals(vitalsEncounterId);
  const {
    data: historicalVitals,
    isLoading: isHistoricalLoading,
    isFetched: isHistoricalFetched,
  } = useGetHistoricalVitals(vitalsEncounterId);

  const heights: VitalsObservationDTO[] = [
    ...(currentVitals?.[VitalFieldNames.VitalHeight] ?? []),
    ...(historicalVitals?.[VitalFieldNames.VitalHeight] ?? []),
  ];
  const weights: VitalsObservationDTO[] = [
    ...(currentVitals?.[VitalFieldNames.VitalWeight] ?? []),
    ...(historicalVitals?.[VitalFieldNames.VitalWeight] ?? []),
  ];

  const vitalsRequired = !patient?.birthDate || is18YearsOrYounger(patient.birthDate);
  const hasVitals = !vitalsRequired || (hasValidHeight(heights) && hasValidWeight(weights));

  return {
    hasVitals,
    isVitalsLoading: isCurrentLoading || isHistoricalLoading,
    isVitalsFetched: isCurrentFetched && isHistoricalFetched,
    missingVitalsMessage: isAnnotationFollowup
      ? `${MISSING_VITALS_MESSAGE} of the original visit`
      : MISSING_VITALS_MESSAGE,
  };
};
