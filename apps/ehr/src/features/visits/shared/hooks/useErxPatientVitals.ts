import { is18YearsOrYounger, VitalFieldNames, VitalsObservationDTO } from 'utils';
import { createVitalsSearchConfig } from 'utils/lib/helpers/visit-note/create-vitals-search-config.helper';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { useChartFields } from './useChartFields';

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

/**
 * Shared eRx patient-vitals readiness used by both the full prescriber flow (<ERX>) and the
 * lightweight interaction-only flow (<ERXInteractionsReadiness>).
 *
 * The upstream eRx provider (DoseSpot) requires height/weight for patients 18 and under before
 * a patient can be synced, so both flows need to know whether those vitals are present.
 */
export const useErxPatientVitals = (): {
  hasVitals: boolean;
  isVitalsLoading: boolean;
  isVitalsFetched: boolean;
} => {
  const { patient, encounter } = useAppointmentData();

  const heightSearchConfig = createVitalsSearchConfig(VitalFieldNames.VitalHeight, 'patient', 1);
  const weightSearchConfig = createVitalsSearchConfig(VitalFieldNames.VitalWeight, 'patient', 1);

  const {
    data: heightVitalObservationResponse,
    isLoading: isHeightLoading,
    isFetched: isHeightFetched,
  } = useChartFields({
    requestedFields: { [heightSearchConfig.fieldName]: heightSearchConfig.searchParams },
    enabled: Boolean(encounter?.id),
  });

  const {
    data: weightVitalObservationResponse,
    isLoading: isWeightLoading,
    isFetched: isWeightFetched,
  } = useChartFields({
    requestedFields: { [weightSearchConfig.fieldName]: weightSearchConfig.searchParams },
    enabled: Boolean(encounter?.id),
  });

  const vitalsRequired = !patient?.birthDate || is18YearsOrYounger(patient.birthDate);
  const hasVitals =
    !vitalsRequired ||
    (hasValidHeight(heightVitalObservationResponse?.vitalsObservations) &&
      hasValidWeight(weightVitalObservationResponse?.vitalsObservations));

  return {
    hasVitals,
    isVitalsLoading: isHeightLoading || isWeightLoading,
    isVitalsFetched: isHeightFetched && isWeightFetched,
  };
};

/**
 * Maps an eRx `syncPatient` failure to a user-facing message. Shared so both eRx flows surface
 * the same guidance (bad phone, missing weight for minors, unconfigured service, etc.).
 */
export const getErxPatientSyncErrorMessage = (
  error: { code?: string; message?: string },
  phoneNumber?: string
): string => {
  if (error.code === '4006') {
    if (error.message?.toLowerCase()?.includes('phone')) {
      return `Patient has specified some wrong phone number: ${phoneNumber}. Please provide a real patient's phone number`;
    }
    if (error.message?.includes('eRx service is not configured')) {
      return `eRx service is not configured. Please contact support.`;
    }
    if (error.message?.includes('Weight must be entered for patient 18 years old and under')) {
      return `Weight must be entered for patient 18 years old and under. Please specify patient's weight in the 'Vitals' tab.`;
    }
    return `Something is wrong with patient data.`;
  }
  return 'Something went wrong while trying to sync patient to eRx';
};
