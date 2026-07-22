import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { uploadDotVisionDocument } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { useVitalsDraftStore } from 'src/state/draft-data.store';
import {
  areVitalsSameDay,
  calculateBMI,
  fahrenheitToCelsius,
  getAbnormalVitals,
  GetVitalsResponseData,
  HeightMeasurement,
  LBS_IN_KG,
  VitalFieldNames,
  VitalsBloodPressureObservationDTO,
  VitalsBMIObservationDTO,
  VitalsHeartbeatObservationDTO,
  VitalsHeightObservationDTO,
  VitalsLastMenstrualPeriodObservationDTO,
  VitalsObservationDTO,
  VitalsOxygenSatObservationDTO,
  VitalsRespirationRateObservationDTO,
  VitalsTemperatureObservationDTO,
  VitalsVisionObservationDTO,
  VitalsVisionOption,
  VitalsWeightObservationDTO,
} from 'utils';
import { useBloodPressureLocalState } from '../blood-pressure/useBloodPressureLocalState';
import { useHeartbeatLocalState } from '../heartbeat/useHeartbeatLocalState';
import { useHeightLocalState } from '../heights/useHeightLocalState';
import { useLMPLocalState } from '../last-menstrual-period/useLMPLocalState';
import { useOxygenSatLocalState } from '../oxygen-saturation/useOxygenSatLocalState';
import { useRespirationRateLocalState } from '../respiration-rate/useRespirationRateLocalState';
import { useTemperatureLocalState } from '../temperature/useTemperatureLocalState';
import { VitalLocalState } from '../types';
import {
  DotVisionScreeningLocalState,
  useDotVisionScreeningLocalState,
} from '../vision/useDotVisionScreeningLocalState';
import { useVisionLocalState } from '../vision/useVisionLocalState';
import { useWeightLocalState } from '../weights/useWeightLocalState';
import { useBatchSaveVitals } from './useBatchSaveVitals';
import { useDeleteVitals } from './useDeleteVitals';
import { useGetHistoricalVitals, useGetVitals } from './useGetVitals';
import { useSaveVitals } from './useSaveVitals';

export interface VitalField<TypeObsDTO extends VitalsObservationDTO = VitalsObservationDTO, LocalState = any> {
  save: () => Promise<void>;
  /** Save with a specific DTO, used for special cases like "patient refused" that bypass form state */
  saveWithDto?: (dto: VitalsObservationDTO) => Promise<void>;
  delete: (vitalEntity: VitalsObservationDTO) => Promise<void>;
  isSaving: boolean;
  isValid: boolean;
  hasData: boolean;
  current: TypeObsDTO[];
  historical: TypeObsDTO[];
  localState: LocalState;
  /**
   * DOT vision screening lives on the same `vital-vision` observation but is captured in its own
   * sub-form (only wired up for the vision field). Kept here so the shared "Add all vitals" flow and
   * the standalone DOT "Add" button save through the same state and document-finalization path.
   */
  dotState?: DotVisionScreeningLocalState;
  saveDot?: () => Promise<void>;
  isSavingDot?: boolean;
  onClearForm?: () => void;
}

export interface UseVitalsManagementProps {
  encounterId: string;
}

export interface VitalCardRefs {
  temperature: React.RefObject<HTMLDivElement>;
  heartbeat: React.RefObject<HTMLDivElement>;
  respirationRate: React.RefObject<HTMLDivElement>;
  bloodPressure: React.RefObject<HTMLDivElement>;
  oxygenSat: React.RefObject<HTMLDivElement>;
  weight: React.RefObject<HTMLDivElement>;
  height: React.RefObject<HTMLDivElement>;
  vision: React.RefObject<HTMLDivElement>;
  lmp: React.RefObject<HTMLDivElement>;
}

export interface VitalsFields {
  temperature: VitalField<VitalsTemperatureObservationDTO, ReturnType<typeof useTemperatureLocalState>>;
  heartbeat: VitalField<VitalsHeartbeatObservationDTO, ReturnType<typeof useHeartbeatLocalState>>;
  respirationRate: VitalField<VitalsRespirationRateObservationDTO, ReturnType<typeof useRespirationRateLocalState>>;
  bloodPressure: VitalField<VitalsBloodPressureObservationDTO, ReturnType<typeof useBloodPressureLocalState>>;
  oxygenSat: VitalField<VitalsOxygenSatObservationDTO, ReturnType<typeof useOxygenSatLocalState>>;
  weight: VitalField<VitalsWeightObservationDTO, ReturnType<typeof useWeightLocalState>>;
  height: VitalField<VitalsHeightObservationDTO, ReturnType<typeof useHeightLocalState>>;
  // BMI is derived and read-only — the read-only subset of a VitalField.
  bmi: Pick<VitalField<VitalsBMIObservationDTO>, 'current' | 'historical' | 'delete'>;
  vision: VitalField<VitalsVisionObservationDTO, ReturnType<typeof useVisionLocalState>>;
  lmp: VitalField<VitalsLastMenstrualPeriodObservationDTO, ReturnType<typeof useLMPLocalState>>;
}

export interface UseVitalsManagementReturn {
  data: {
    encounter: GetVitalsResponseData | undefined;
    historical: GetVitalsResponseData | undefined;
    isLoading: boolean;
  };
  fields: VitalsFields;
  saveAll: () => Promise<void>;
  isSavingAll: boolean;
  canSaveAll: boolean;
  clearAllDrafts: () => void;
  refs: VitalCardRefs;
  abnormalVitalsValues: GetVitalsResponseData;
}

const getValidationErrorMessage = (state: VitalLocalState): string | undefined => {
  return 'validationErrorMessage' in state ? state.validationErrorMessage : undefined;
};

// BMI derives only from a height and weight recorded on the same day (encounters can span days).
const deriveBMIInputs = (
  vitals: GetVitalsResponseData | undefined
): { heightCm: number | undefined; weightKg: number | undefined } => {
  const height = vitals?.[VitalFieldNames.VitalHeight]?.[0];
  const weight = vitals?.[VitalFieldNames.VitalWeight]?.[0];
  return areVitalsSameDay(height?.lastUpdated, weight?.lastUpdated)
    ? { heightCm: height?.value, weightKg: weight?.value }
    : { heightCm: undefined, weightKg: undefined };
};

export const useVitalsManagement = ({ encounterId }: UseVitalsManagementProps): UseVitalsManagementReturn => {
  const saveVitals = useSaveVitals({ encounterId });
  const batchSaveVitals = useBatchSaveVitals({ encounterId });
  const deleteVitals = useDeleteVitals({ encounterId });

  const {
    data: encounterVitals,
    isLoading: encounterVitalsLoading,
    refetch: refetchEncounterVitals,
  } = useGetVitals(encounterId);

  const { data: historicalVitals } = useGetHistoricalVitals(encounterId);

  // Local state hooks for each vital
  const temperatureState = useTemperatureLocalState();
  const heartbeatState = useHeartbeatLocalState();
  const respirationRateState = useRespirationRateLocalState();
  const bloodPressureState = useBloodPressureLocalState();
  const oxygenSatState = useOxygenSatLocalState();
  const weightState = useWeightLocalState();
  const heightState = useHeightLocalState();
  const visionState = useVisionLocalState();
  const dotVisionState = useDotVisionScreeningLocalState();
  const lmpState = useLMPLocalState();

  const { setDraft, getDraft, clearDraft } = useVitalsDraftStore();

  // One-shot draft hydration on mount — reads sessionStorage and restores form values.
  // useEffect is appropriate here: we're reading from external storage to seed React state.
  useEffect(() => {
    if (!encounterId) return;
    const d = getDraft(encounterId);
    const e = (v: string): ChangeEvent<HTMLInputElement> => ({ target: { value: v } }) as ChangeEvent<HTMLInputElement>;
    if (d.temperature) {
      if (isFinite(d.temperature.value)) temperatureState.handleCelsiusChange(e(String(d.temperature.value)));
      if (d.temperature.observationMethod) temperatureState.handleQualifierChange(d.temperature.observationMethod);
    }
    if (d.heartbeat) {
      if (isFinite(d.heartbeat.value)) heartbeatState.handleValueChange(e(String(d.heartbeat.value)));
      if (d.heartbeat.observationMethod) heartbeatState.handleQualifierChange(d.heartbeat.observationMethod);
    }
    if (d.respirationRate) {
      if (isFinite(d.respirationRate.value)) respirationRateState.handleValueChange(e(String(d.respirationRate.value)));
    }
    if (d.bloodPressure) {
      if (isFinite(d.bloodPressure.systolicPressure))
        bloodPressureState.handleSystolicChange(e(String(d.bloodPressure.systolicPressure)));
      if (isFinite(d.bloodPressure.diastolicPressure))
        bloodPressureState.handleDiastolicChange(e(String(d.bloodPressure.diastolicPressure)));
      if (d.bloodPressure.observationMethod)
        bloodPressureState.handleQualifierChange(d.bloodPressure.observationMethod);
    }
    if (d.oxygenSat) {
      if (isFinite(d.oxygenSat.value)) oxygenSatState.handleValueChange(e(String(d.oxygenSat.value)));
      if (d.oxygenSat.observationMethod) oxygenSatState.handleQualifierChange(d.oxygenSat.observationMethod);
    }
    const draftWeight = d.weight as { value?: number } | undefined;
    if (draftWeight?.value !== undefined && isFinite(draftWeight.value)) {
      weightState.handleKgInput(e(String(draftWeight.value)));
    }
    if (d.height && isFinite(d.height.value)) {
      heightState.handleCmChange(e(String(d.height.value)));
    }
    if (d.vision) {
      if (d.vision.leftEyeVisionText)
        visionState.handleLeftEyeChange({ target: { value: d.vision.leftEyeVisionText } });
      if (d.vision.rightEyeVisionText)
        visionState.handleRightEyeChange({ target: { value: d.vision.rightEyeVisionText } });
      if (d.vision.bothEyesVisionText)
        visionState.handleBothEyesChange({ target: { value: d.vision.bothEyesVisionText } });
      d.vision.extraVisionOptions?.forEach((opt) => visionState.handleVisionOptionChange(true, opt));
    }
    if (d.lmp) {
      if (d.lmp.value) lmpState.handleDateChange(DateTime.fromISO(d.lmp.value));
      if (d.lmp.isUnsure) lmpState.handleUnsureChange(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Draft-writing handler wrappers ---
  // Each wrapper calls the original handler then synchronously writes the updated draft value,
  // using the new value from the event parameter and reading unchanged siblings from the closure.

  const handleTemperatureCelsiusChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      temperatureState.handleCelsiusChange(e);
      const celsius = parseFloat(e.target.value);
      setDraft(encounterId, {
        temperature:
          isFinite(celsius) || temperatureState.observationQualifier
            ? ({
                field: VitalFieldNames.VitalTemperature,
                value: celsius,
                ...(temperatureState.observationQualifier && {
                  observationMethod: temperatureState.observationQualifier,
                }),
              } as VitalsTemperatureObservationDTO)
            : undefined,
      });
    },
    [temperatureState, encounterId, setDraft]
  );

  const handleTemperatureFahrenheitChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      temperatureState.handleFahrenheitChange(e);
      const fahrenheit = parseFloat(e.target.value);
      const celsius = isFinite(fahrenheit) ? fahrenheitToCelsius(fahrenheit) : NaN;
      setDraft(encounterId, {
        temperature:
          isFinite(celsius) || temperatureState.observationQualifier
            ? ({
                field: VitalFieldNames.VitalTemperature,
                value: celsius,
                ...(temperatureState.observationQualifier && {
                  observationMethod: temperatureState.observationQualifier,
                }),
              } as VitalsTemperatureObservationDTO)
            : undefined,
      });
    },
    [temperatureState, encounterId, setDraft]
  );

  const handleTemperatureQualifierChange = useCallback(
    (qualifier: string): void => {
      temperatureState.handleQualifierChange(qualifier);
      const celsius = parseFloat(temperatureState.valueCelsius);
      setDraft(encounterId, {
        temperature:
          isFinite(celsius) || qualifier
            ? ({
                field: VitalFieldNames.VitalTemperature,
                value: celsius,
                ...(qualifier && { observationMethod: qualifier }),
              } as VitalsTemperatureObservationDTO)
            : undefined,
      });
    },
    [temperatureState, encounterId, setDraft]
  );

  const handleHeartbeatValueChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      heartbeatState.handleValueChange(e);
      const value = parseFloat(e.target.value);
      setDraft(encounterId, {
        heartbeat:
          isFinite(value) || heartbeatState.observationQualifier
            ? ({
                field: VitalFieldNames.VitalHeartbeat,
                value,
                ...(heartbeatState.observationQualifier && { observationMethod: heartbeatState.observationQualifier }),
              } as VitalsHeartbeatObservationDTO)
            : undefined,
      });
    },
    [heartbeatState, encounterId, setDraft]
  );

  const handleHeartbeatQualifierChange = useCallback(
    (qualifier: string): void => {
      heartbeatState.handleQualifierChange(qualifier);
      const value = parseFloat(heartbeatState.value);
      setDraft(encounterId, {
        heartbeat:
          isFinite(value) || qualifier
            ? ({
                field: VitalFieldNames.VitalHeartbeat,
                value,
                ...(qualifier && { observationMethod: qualifier }),
              } as VitalsHeartbeatObservationDTO)
            : undefined,
      });
    },
    [heartbeatState, encounterId, setDraft]
  );

  const handleRespirationRateValueChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      respirationRateState.handleValueChange(e);
      const value = parseFloat(e.target.value);
      setDraft(encounterId, {
        respirationRate: isFinite(value)
          ? ({ field: VitalFieldNames.VitalRespirationRate, value } as VitalsRespirationRateObservationDTO)
          : undefined,
      });
    },
    [respirationRateState, encounterId, setDraft]
  );

  const handleBloodPressureSystolicChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      bloodPressureState.handleSystolicChange(e);
      const systolic = parseFloat(e.target.value);
      const diastolic = parseFloat(bloodPressureState.diastolicValue);
      const hasAnyData =
        e.target.value.length > 0 ||
        bloodPressureState.diastolicValue.length > 0 ||
        bloodPressureState.observationQualifier.length > 0;
      setDraft(encounterId, {
        bloodPressure: hasAnyData
          ? ({
              field: VitalFieldNames.VitalBloodPressure,
              systolicPressure: systolic,
              diastolicPressure: diastolic,
              ...(bloodPressureState.observationQualifier && {
                observationMethod: bloodPressureState.observationQualifier,
              }),
            } as VitalsBloodPressureObservationDTO)
          : undefined,
      });
    },
    [bloodPressureState, encounterId, setDraft]
  );

  const handleBloodPressureDiastolicChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      bloodPressureState.handleDiastolicChange(e);
      const systolic = parseFloat(bloodPressureState.systolicValue);
      const diastolic = parseFloat(e.target.value);
      const hasAnyData =
        bloodPressureState.systolicValue.length > 0 ||
        e.target.value.length > 0 ||
        bloodPressureState.observationQualifier.length > 0;
      setDraft(encounterId, {
        bloodPressure: hasAnyData
          ? ({
              field: VitalFieldNames.VitalBloodPressure,
              systolicPressure: systolic,
              diastolicPressure: diastolic,
              ...(bloodPressureState.observationQualifier && {
                observationMethod: bloodPressureState.observationQualifier,
              }),
            } as VitalsBloodPressureObservationDTO)
          : undefined,
      });
    },
    [bloodPressureState, encounterId, setDraft]
  );

  const handleBloodPressureQualifierChange = useCallback(
    (qualifier: string): void => {
      bloodPressureState.handleQualifierChange(qualifier);
      const systolic = parseFloat(bloodPressureState.systolicValue);
      const diastolic = parseFloat(bloodPressureState.diastolicValue);
      const hasAnyData =
        bloodPressureState.systolicValue.length > 0 ||
        bloodPressureState.diastolicValue.length > 0 ||
        qualifier.length > 0;
      setDraft(encounterId, {
        bloodPressure: hasAnyData
          ? ({
              field: VitalFieldNames.VitalBloodPressure,
              systolicPressure: systolic,
              diastolicPressure: diastolic,
              ...(qualifier && { observationMethod: qualifier }),
            } as VitalsBloodPressureObservationDTO)
          : undefined,
      });
    },
    [bloodPressureState, encounterId, setDraft]
  );

  const handleOxygenSatValueChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      oxygenSatState.handleValueChange(e);
      const value = parseFloat(e.target.value);
      setDraft(encounterId, {
        oxygenSat:
          isFinite(value) || oxygenSatState.observationQualifier
            ? ({
                field: VitalFieldNames.VitalOxygenSaturation,
                value,
                ...(oxygenSatState.observationQualifier && { observationMethod: oxygenSatState.observationQualifier }),
              } as VitalsOxygenSatObservationDTO)
            : undefined,
      });
    },
    [oxygenSatState, encounterId, setDraft]
  );

  const handleOxygenSatQualifierChange = useCallback(
    (qualifier: string): void => {
      oxygenSatState.handleQualifierChange(qualifier);
      const value = parseFloat(oxygenSatState.value);
      setDraft(encounterId, {
        oxygenSat:
          isFinite(value) || qualifier
            ? ({
                field: VitalFieldNames.VitalOxygenSaturation,
                value,
                ...(qualifier && { observationMethod: qualifier }),
              } as VitalsOxygenSatObservationDTO)
            : undefined,
      });
    },
    [oxygenSatState, encounterId, setDraft]
  );

  const handleWeightKgInput = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      weightState.handleKgInput(e);
      const kg = parseFloat(e.target.value);
      setDraft(encounterId, {
        weight: isFinite(kg)
          ? ({ field: VitalFieldNames.VitalWeight, value: kg } as VitalsWeightObservationDTO)
          : undefined,
      });
    },
    [weightState, encounterId, setDraft]
  );

  const handleWeightLbsInput = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      weightState.handleLbsInput(e);
      const lbs = parseFloat(e.target.value);
      const kg = isFinite(lbs) ? lbs / LBS_IN_KG : NaN;
      setDraft(encounterId, {
        weight: isFinite(kg)
          ? ({ field: VitalFieldNames.VitalWeight, value: kg } as VitalsWeightObservationDTO)
          : undefined,
      });
    },
    [weightState, encounterId, setDraft]
  );

  const handleHeightCmChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      heightState.handleCmChange(e);
      const measurement = HeightMeasurement.fromCmText(e.target.value);
      setDraft(encounterId, {
        height: measurement
          ? ({ field: VitalFieldNames.VitalHeight, value: measurement.getCm() } as VitalsHeightObservationDTO)
          : undefined,
      });
    },
    [heightState, encounterId, setDraft]
  );

  const handleHeightInchesChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      heightState.handleInchesChange(e);
      const measurement = HeightMeasurement.fromInchesText(e.target.value);
      setDraft(encounterId, {
        height: measurement
          ? ({ field: VitalFieldNames.VitalHeight, value: measurement.getCm() } as VitalsHeightObservationDTO)
          : undefined,
      });
    },
    [heightState, encounterId, setDraft]
  );

  const handleHeightFeetChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      heightState.handleFeetChange(e);
      const measurement = HeightMeasurement.fromFeetInchesText(e.target.value, heightState.valueInchRemainder);
      setDraft(encounterId, {
        height: measurement
          ? ({ field: VitalFieldNames.VitalHeight, value: measurement.getCm() } as VitalsHeightObservationDTO)
          : undefined,
      });
    },
    [heightState, encounterId, setDraft]
  );

  const handleHeightInchRemainderChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      heightState.handleInchRemainderChange(e);
      const measurement = HeightMeasurement.fromFeetInchesText(heightState.valueFeet, e.target.value);
      setDraft(encounterId, {
        height: measurement
          ? ({ field: VitalFieldNames.VitalHeight, value: measurement.getCm() } as VitalsHeightObservationDTO)
          : undefined,
      });
    },
    [heightState, encounterId, setDraft]
  );

  const handleVisionLeftEyeChange = useCallback(
    (event: { target: { value: string } }): void => {
      visionState.handleLeftEyeChange(event);
      const hasAnyData =
        event.target.value.length > 0 ||
        visionState.rightEyeSelection.length > 0 ||
        visionState.bothEyesSelection.length > 0 ||
        visionState.isChildTooYoungSelected ||
        visionState.isWithGlassesSelected ||
        visionState.isWithoutGlassesSelected;
      setDraft(encounterId, {
        vision: hasAnyData
          ? ({
              field: VitalFieldNames.VitalVision,
              leftEyeVisionText: event.target.value,
              rightEyeVisionText: visionState.rightEyeSelection,
              ...(visionState.bothEyesSelection && { bothEyesVisionText: visionState.bothEyesSelection }),
              ...(visionState.isChildTooYoungSelected ||
              visionState.isWithGlassesSelected ||
              visionState.isWithoutGlassesSelected
                ? {
                    extraVisionOptions: [
                      ...(visionState.isChildTooYoungSelected ? (['child_too_young'] as VitalsVisionOption[]) : []),
                      ...(visionState.isWithGlassesSelected ? (['with_glasses'] as VitalsVisionOption[]) : []),
                      ...(visionState.isWithoutGlassesSelected ? (['without_glasses'] as VitalsVisionOption[]) : []),
                    ],
                  }
                : {}),
            } as VitalsVisionObservationDTO)
          : undefined,
      });
    },
    [visionState, encounterId, setDraft]
  );

  const handleVisionRightEyeChange = useCallback(
    (event: { target: { value: string } }): void => {
      visionState.handleRightEyeChange(event);
      const hasAnyData =
        visionState.leftEyeSelection.length > 0 ||
        event.target.value.length > 0 ||
        visionState.bothEyesSelection.length > 0 ||
        visionState.isChildTooYoungSelected ||
        visionState.isWithGlassesSelected ||
        visionState.isWithoutGlassesSelected;
      setDraft(encounterId, {
        vision: hasAnyData
          ? ({
              field: VitalFieldNames.VitalVision,
              leftEyeVisionText: visionState.leftEyeSelection,
              rightEyeVisionText: event.target.value,
              ...(visionState.bothEyesSelection && { bothEyesVisionText: visionState.bothEyesSelection }),
              ...(visionState.isChildTooYoungSelected ||
              visionState.isWithGlassesSelected ||
              visionState.isWithoutGlassesSelected
                ? {
                    extraVisionOptions: [
                      ...(visionState.isChildTooYoungSelected ? (['child_too_young'] as VitalsVisionOption[]) : []),
                      ...(visionState.isWithGlassesSelected ? (['with_glasses'] as VitalsVisionOption[]) : []),
                      ...(visionState.isWithoutGlassesSelected ? (['without_glasses'] as VitalsVisionOption[]) : []),
                    ],
                  }
                : {}),
            } as VitalsVisionObservationDTO)
          : undefined,
      });
    },
    [visionState, encounterId, setDraft]
  );

  const handleVisionBothEyesChange = useCallback(
    (event: { target: { value: string } }): void => {
      visionState.handleBothEyesChange(event);
      const hasAnyData =
        visionState.leftEyeSelection.length > 0 ||
        visionState.rightEyeSelection.length > 0 ||
        event.target.value.length > 0 ||
        visionState.isChildTooYoungSelected ||
        visionState.isWithGlassesSelected ||
        visionState.isWithoutGlassesSelected;
      setDraft(encounterId, {
        vision: hasAnyData
          ? ({
              field: VitalFieldNames.VitalVision,
              leftEyeVisionText: visionState.leftEyeSelection,
              rightEyeVisionText: visionState.rightEyeSelection,
              ...(event.target.value && { bothEyesVisionText: event.target.value }),
              ...(visionState.isChildTooYoungSelected ||
              visionState.isWithGlassesSelected ||
              visionState.isWithoutGlassesSelected
                ? {
                    extraVisionOptions: [
                      ...(visionState.isChildTooYoungSelected ? (['child_too_young'] as VitalsVisionOption[]) : []),
                      ...(visionState.isWithGlassesSelected ? (['with_glasses'] as VitalsVisionOption[]) : []),
                      ...(visionState.isWithoutGlassesSelected ? (['without_glasses'] as VitalsVisionOption[]) : []),
                    ],
                  }
                : {}),
            } as VitalsVisionObservationDTO)
          : undefined,
      });
    },
    [visionState, encounterId, setDraft]
  );

  const handleVisionOptionChange = useCallback(
    (isChecked: boolean, option: VitalsVisionOption): void => {
      visionState.handleVisionOptionChange(isChecked, option);
      // Replicate the mutual-exclusion logic from the local state hook
      const newIsChildTooYoung = option === 'child_too_young' ? isChecked : visionState.isChildTooYoungSelected;
      const newIsWithGlasses =
        option === 'with_glasses'
          ? isChecked
          : option === 'without_glasses'
          ? false
          : visionState.isWithGlassesSelected;
      const newIsWithoutGlasses =
        option === 'without_glasses'
          ? isChecked
          : option === 'with_glasses'
          ? false
          : visionState.isWithoutGlassesSelected;
      const extraVisionOptions: VitalsVisionOption[] = [
        ...(newIsChildTooYoung ? (['child_too_young'] as VitalsVisionOption[]) : []),
        ...(newIsWithGlasses ? (['with_glasses'] as VitalsVisionOption[]) : []),
        ...(newIsWithoutGlasses ? (['without_glasses'] as VitalsVisionOption[]) : []),
      ];
      const hasAnyData =
        visionState.leftEyeSelection.length > 0 ||
        visionState.rightEyeSelection.length > 0 ||
        visionState.bothEyesSelection.length > 0 ||
        newIsChildTooYoung ||
        newIsWithGlasses ||
        newIsWithoutGlasses;
      setDraft(encounterId, {
        vision: hasAnyData
          ? ({
              field: VitalFieldNames.VitalVision,
              leftEyeVisionText: visionState.leftEyeSelection,
              rightEyeVisionText: visionState.rightEyeSelection,
              ...(visionState.bothEyesSelection && { bothEyesVisionText: visionState.bothEyesSelection }),
              ...(extraVisionOptions.length > 0 && { extraVisionOptions }),
            } as VitalsVisionObservationDTO)
          : undefined,
      });
    },
    [visionState, encounterId, setDraft]
  );

  const handleLMPDateChange = useCallback(
    (date: DateTime | null): void => {
      lmpState.handleDateChange(date);
      setDraft(encounterId, {
        lmp:
          date !== null || lmpState.isUnsureSelected
            ? ({
                field: VitalFieldNames.VitalLastMenstrualPeriod,
                value: date?.isValid ? date.toISODate() ?? '' : '',
                ...(lmpState.isUnsureSelected && { isUnsure: true }),
              } as VitalsLastMenstrualPeriodObservationDTO)
            : undefined,
      });
    },
    [lmpState, encounterId, setDraft]
  );

  const handleLMPUnsureChange = useCallback(
    (isChecked: boolean): void => {
      lmpState.handleUnsureChange(isChecked);
      setDraft(encounterId, {
        lmp:
          lmpState.selectedDate !== null || isChecked
            ? ({
                field: VitalFieldNames.VitalLastMenstrualPeriod,
                value: lmpState.selectedDate?.isValid ? lmpState.selectedDate.toISODate() ?? '' : '',
                ...(isChecked && { isUnsure: true }),
              } as VitalsLastMenstrualPeriodObservationDTO)
            : undefined,
      });
    },
    [lmpState, encounterId, setDraft]
  );

  const { id: appointmentId } = useParams();
  const { oystehrZambda } = useApiClients();

  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [isSavingDot, setIsSavingDot] = useState(false);
  const [fieldSavingStates, setFieldSavingStates] = useState<Partial<Record<VitalFieldNames, boolean>>>({});

  // Create the referral DocumentReference lazily, only when a DOT entry that carries an attached
  // (but not-yet-persisted) file is saved, so an attached-then-discarded file never orphans a
  // DocumentReference. Shared by both the standalone DOT "Add" and the "Add all vitals" flow.
  const finalizeDotVisionDocument = useCallback(
    async (dto: VitalsVisionObservationDTO): Promise<VitalsVisionObservationDTO> => {
      const pendingDoc = dto.dotVisionScreening?.document;
      if (pendingDoc?.url && !pendingDoc.documentReferenceId && appointmentId && oystehrZambda) {
        const result = await uploadDotVisionDocument(oystehrZambda, {
          appointmentID: appointmentId,
          z3URL: pendingDoc.url,
          title: pendingDoc.title,
        });
        return {
          ...dto,
          dotVisionScreening: {
            ...dto.dotVisionScreening,
            document: { documentReferenceId: result.documentRefId, url: result.url, title: result.title },
          },
        };
      }
      return dto;
    },
    [appointmentId, oystehrZambda]
  );

  // Refs for all vital cards
  const temperatureCardRef = useRef<HTMLDivElement>(null);
  const heartbeatCardRef = useRef<HTMLDivElement>(null);
  const respirationRateCardRef = useRef<HTMLDivElement>(null);
  const bloodPressureCardRef = useRef<HTMLDivElement>(null);
  const oxygenSatCardRef = useRef<HTMLDivElement>(null);
  const weightCardRef = useRef<HTMLDivElement>(null);
  const heightCardRef = useRef<HTMLDivElement>(null);
  const visionCardRef = useRef<HTMLDivElement>(null);
  const lmpCardRef = useRef<HTMLDivElement>(null);

  const handleSaveVital = useCallback(
    async (vitalEntity: VitalsObservationDTO): Promise<void> => {
      await saveVitals(vitalEntity);
      await refetchEncounterVitals();
    },
    [saveVitals, refetchEncounterVitals]
  );

  const handleSaveDot = useCallback(async (): Promise<void> => {
    const dto = dotVisionState.getDTO();
    if (!dto) return;
    try {
      setIsSavingDot(true);
      const finalized = await finalizeDotVisionDocument(dto);
      await handleSaveVital(finalized);
      dotVisionState.clearForm();
    } catch {
      enqueueSnackbar('Error saving DOT Vision Screening data', { variant: 'error' });
    } finally {
      setIsSavingDot(false);
    }
  }, [dotVisionState, finalizeDotVisionDocument, handleSaveVital]);

  // Saves a derived BMI when both inputs exist. Doesn't refetch; caller refetches once. Returns whether it saved.
  const saveBMI = useCallback(
    async (weightKg: number | undefined, heightCm: number | undefined): Promise<boolean> => {
      if (!weightKg || !heightCm) return false;
      const bmiDto: VitalsBMIObservationDTO = {
        field: VitalFieldNames.VitalBMI,
        value: calculateBMI(weightKg, heightCm),
      };
      await saveVitals(bmiDto);
      return true;
    },
    [saveVitals]
  );

  const handleDeleteVital = useCallback(
    async (vitalEntity: VitalsObservationDTO): Promise<void> => {
      await deleteVitals(vitalEntity);
      await refetchEncounterVitals();
    },
    [deleteVitals, refetchEncounterVitals]
  );

  const vitalCardRefs: VitalCardRefs = {
    temperature: temperatureCardRef,
    heartbeat: heartbeatCardRef,
    respirationRate: respirationRateCardRef,
    bloodPressure: bloodPressureCardRef,
    oxygenSat: oxygenSatCardRef,
    weight: weightCardRef,
    height: heightCardRef,
    vision: visionCardRef,
    lmp: lmpCardRef,
  };

  const handleAddAllVitals = useCallback(async () => {
    // Map field names to refs and local states
    const fieldMap: Record<
      Exclude<VitalFieldNames, VitalFieldNames.VitalBMI>,
      {
        ref: React.RefObject<HTMLDivElement>;
        state: VitalLocalState;
      }
    > = {
      [VitalFieldNames.VitalTemperature]: { ref: temperatureCardRef, state: temperatureState },
      [VitalFieldNames.VitalHeartbeat]: { ref: heartbeatCardRef, state: heartbeatState },
      [VitalFieldNames.VitalRespirationRate]: { ref: respirationRateCardRef, state: respirationRateState },
      [VitalFieldNames.VitalBloodPressure]: { ref: bloodPressureCardRef, state: bloodPressureState },
      [VitalFieldNames.VitalOxygenSaturation]: { ref: oxygenSatCardRef, state: oxygenSatState },
      [VitalFieldNames.VitalWeight]: { ref: weightCardRef, state: weightState },
      [VitalFieldNames.VitalHeight]: { ref: heightCardRef, state: heightState },
      [VitalFieldNames.VitalVision]: { ref: visionCardRef, state: visionState },
      [VitalFieldNames.VitalLastMenstrualPeriod]: { ref: lmpCardRef, state: lmpState },
    };

    type NonBMIVitalFieldNames = Exclude<VitalFieldNames, VitalFieldNames.VitalBMI>;
    const { invalidFields, validVitalsEntries } = Object.entries(fieldMap).reduce<{
      invalidFields: NonBMIVitalFieldNames[];
      validVitalsEntries: [string, { ref: React.RefObject<HTMLDivElement>; state: VitalLocalState }][];
    }>(
      (acc, entry) => {
        const [fieldName, { state }] = entry;
        const field = fieldName as NonBMIVitalFieldNames;

        // Exclude Weight if Patient Refused is selected (it saves immediately)
        if (field === VitalFieldNames.VitalWeight && weightState.isPatientRefusedSelected) {
          return acc;
        }

        if (state.hasData && !state.isValid) {
          acc.invalidFields.push(field);
        } else if (state.isValid) {
          acc.validVitalsEntries.push(entry);
        }

        return acc;
      },
      { invalidFields: [], validVitalsEntries: [] }
    );

    const validVitals = validVitalsEntries
      .map(([_, { state }]) => state.getDTO())
      .filter((dto): dto is NonNullable<typeof dto> => dto !== null);

    // DOT vision screening is captured in its own sub-form (not part of fieldMap); fold it into the
    // same batch so "Add all vitals" doesn't silently drop it.
    const dotDtoToSave = dotVisionState.hasData && dotVisionState.isValid ? dotVisionState.getDTO() : null;
    const dotInvalid = dotVisionState.hasData && !dotVisionState.isValid;

    // Save valid vitals
    if (validVitals.length > 0 || dotDtoToSave) {
      setIsBatchSaving(true);
      try {
        const vitalsToSave = [...validVitals];
        if (dotDtoToSave) {
          // Finalize the referral DocumentReference (if any) before persisting the observation.
          vitalsToSave.push(await finalizeDotVisionDocument(dotDtoToSave));
        }
        await batchSaveVitals(vitalsToSave);
        const refetchResult = await refetchEncounterVitals();

        // Clear only the forms that were saved
        validVitalsEntries.forEach(([_, { state }]) => {
          state.clearForm();
        });
        if (dotDtoToSave) {
          dotVisionState.clearForm();
        }
        const vitalText = vitalsToSave.length === 1 ? 'vital' : 'vitals';
        enqueueSnackbar(`Successfully saved ${vitalsToSave.length} ${vitalText}`, {
          variant: 'success',
        });

        // Auto-save BMI if height or weight was saved; isolated so a BMI failure doesn't flag the saved vitals.
        const savedFields = validVitals.map((v) => v.field);
        // Clear draft entries for saved vitals
        if (savedFields.includes(VitalFieldNames.VitalTemperature)) setDraft(encounterId, { temperature: undefined });
        if (savedFields.includes(VitalFieldNames.VitalHeartbeat)) setDraft(encounterId, { heartbeat: undefined });
        if (savedFields.includes(VitalFieldNames.VitalRespirationRate))
          setDraft(encounterId, { respirationRate: undefined });
        if (savedFields.includes(VitalFieldNames.VitalBloodPressure))
          setDraft(encounterId, { bloodPressure: undefined });
        if (savedFields.includes(VitalFieldNames.VitalOxygenSaturation))
          setDraft(encounterId, { oxygenSat: undefined });
        if (savedFields.includes(VitalFieldNames.VitalWeight)) setDraft(encounterId, { weight: undefined });
        if (savedFields.includes(VitalFieldNames.VitalHeight)) setDraft(encounterId, { height: undefined });
        if (savedFields.includes(VitalFieldNames.VitalVision)) setDraft(encounterId, { vision: undefined });
        if (savedFields.includes(VitalFieldNames.VitalHeight) || savedFields.includes(VitalFieldNames.VitalWeight)) {
          try {
            const { heightCm, weightKg } = deriveBMIInputs(refetchResult.data);
            if (await saveBMI(weightKg, heightCm)) {
              await refetchEncounterVitals();
            }
          } catch {
            enqueueSnackbar('Error saving BMI data', { variant: 'error' });
          }
        }
      } catch {
        enqueueSnackbar('Error saving vitals', { variant: 'error' });
      } finally {
        setIsBatchSaving(false);
      }
    }

    // After saving (or if nothing to save), handle invalid fields
    if (invalidFields.length > 0) {
      // Set validation error for all invalid fields
      invalidFields.forEach((fieldName) => {
        fieldMap[fieldName].state.setValidationError(true);
      });

      // Scroll to first invalid field
      fieldMap[invalidFields[0]].ref.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      const vitalText = invalidFields.length === 1 ? 'vital' : 'vitals';
      const validationErrorMessage = invalidFields
        .map((fieldName) => getValidationErrorMessage(fieldMap[fieldName].state))
        .find((message): message is string => !!message);
      enqueueSnackbar(validationErrorMessage ?? `Failed to save ${invalidFields.length} ${vitalText}`, {
        variant: 'error',
      });
    }

    // DOT invalid values (e.g. out-of-range degrees) are flagged inline on the inputs; also surface
    // a message and bring the vision card into view.
    if (dotInvalid) {
      visionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      enqueueSnackbar('DOT Vision Screening has invalid values', { variant: 'error' });
    }
  }, [
    temperatureState,
    heartbeatState,
    respirationRateState,
    bloodPressureState,
    oxygenSatState,
    weightState,
    heightState,
    visionState,
    dotVisionState,
    finalizeDotVisionDocument,
    lmpState,
    batchSaveVitals,
    refetchEncounterVitals,
    saveBMI,
    setDraft,
    encounterId,
  ]);

  // Helper to create field save handler with validation
  const createFieldSaveHandler = useCallback(
    (field: VitalFieldNames, state: VitalLocalState, triggerBMI = false, clearDraftEntry?: () => void) =>
      async () => {
        if (fieldSavingStates[field]) {
          return;
        }

        if (!state.isValid) {
          state.setValidationError(true);
          const validationErrorMessage = getValidationErrorMessage(state);
          if (validationErrorMessage) {
            enqueueSnackbar(validationErrorMessage, { variant: 'error' });
          }
          return;
        }

        const dto = state.getDTO();
        if (dto) {
          try {
            setFieldSavingStates((prev) => ({ ...prev, [field]: true }));
            await saveVitals(dto);
            // Refetch first so BMI derivation sees the just-saved reading with its server date.
            const refetchResult = await refetchEncounterVitals();
            if (triggerBMI) {
              try {
                const { heightCm, weightKg } = deriveBMIInputs(refetchResult.data);
                if (await saveBMI(weightKg, heightCm)) {
                  await refetchEncounterVitals();
                }
              } catch {
                enqueueSnackbar('Error saving BMI data', { variant: 'error' });
              }
            }
            state.clearForm();
            clearDraftEntry?.();
          } catch {
            const fieldNameMap: Record<VitalFieldNames, string> = {
              [VitalFieldNames.VitalTemperature]: 'Temperature',
              [VitalFieldNames.VitalHeartbeat]: 'Heartbeat',
              [VitalFieldNames.VitalRespirationRate]: 'Respiration Rate',
              [VitalFieldNames.VitalBloodPressure]: 'Blood Pressure',
              [VitalFieldNames.VitalOxygenSaturation]: 'Oxygen Saturation',
              [VitalFieldNames.VitalWeight]: 'Weight',
              [VitalFieldNames.VitalHeight]: 'Height',
              [VitalFieldNames.VitalBMI]: 'BMI',
              [VitalFieldNames.VitalVision]: 'Vision',
              [VitalFieldNames.VitalLastMenstrualPeriod]: 'Last Menstrual Period',
            };
            enqueueSnackbar(`Error saving ${fieldNameMap[field] || ''} data`, { variant: 'error' });
          } finally {
            setFieldSavingStates((prev) => ({ ...prev, [field]: false }));
          }
        }
      },
    [fieldSavingStates, saveVitals, refetchEncounterVitals, saveBMI]
  );

  const saveHandlers = useMemo(() => {
    return {
      [VitalFieldNames.VitalTemperature]: createFieldSaveHandler(
        VitalFieldNames.VitalTemperature,
        temperatureState,
        false,
        () => setDraft(encounterId, { temperature: undefined })
      ),
      [VitalFieldNames.VitalHeartbeat]: createFieldSaveHandler(
        VitalFieldNames.VitalHeartbeat,
        heartbeatState,
        false,
        () => setDraft(encounterId, { heartbeat: undefined })
      ),
      [VitalFieldNames.VitalRespirationRate]: createFieldSaveHandler(
        VitalFieldNames.VitalRespirationRate,
        respirationRateState,
        false,
        () => setDraft(encounterId, { respirationRate: undefined })
      ),
      [VitalFieldNames.VitalBloodPressure]: createFieldSaveHandler(
        VitalFieldNames.VitalBloodPressure,
        bloodPressureState,
        false,
        () => setDraft(encounterId, { bloodPressure: undefined })
      ),
      [VitalFieldNames.VitalOxygenSaturation]: createFieldSaveHandler(
        VitalFieldNames.VitalOxygenSaturation,
        oxygenSatState,
        false,
        () => setDraft(encounterId, { oxygenSat: undefined })
      ),
      [VitalFieldNames.VitalWeight]: createFieldSaveHandler(VitalFieldNames.VitalWeight, weightState, true, () =>
        setDraft(encounterId, { weight: undefined })
      ),
      [VitalFieldNames.VitalHeight]: createFieldSaveHandler(VitalFieldNames.VitalHeight, heightState, true, () =>
        setDraft(encounterId, { height: undefined })
      ),
      [VitalFieldNames.VitalVision]: createFieldSaveHandler(VitalFieldNames.VitalVision, visionState, false, () =>
        setDraft(encounterId, { vision: undefined })
      ),
      [VitalFieldNames.VitalLastMenstrualPeriod]: createFieldSaveHandler(
        VitalFieldNames.VitalLastMenstrualPeriod,
        lmpState,
        false,
        () => setDraft(encounterId, { lmp: undefined })
      ),
    };
  }, [
    createFieldSaveHandler,
    temperatureState,
    heartbeatState,
    respirationRateState,
    bloodPressureState,
    oxygenSatState,
    weightState,
    heightState,
    visionState,
    lmpState,
    setDraft,
    encounterId,
  ]);

  const fields = {
    temperature: {
      save: saveHandlers[VitalFieldNames.VitalTemperature],
      saveWithDto: handleSaveVital,
      delete: handleDeleteVital,
      isSaving: fieldSavingStates[VitalFieldNames.VitalTemperature] ?? false,
      isValid: temperatureState.isValid,
      hasData: temperatureState.hasData,
      current: (encounterVitals?.[VitalFieldNames.VitalTemperature] as VitalsTemperatureObservationDTO[]) ?? [],
      historical: (historicalVitals?.[VitalFieldNames.VitalTemperature] as VitalsTemperatureObservationDTO[]) ?? [],
      localState: {
        ...temperatureState,
        handleCelsiusChange: handleTemperatureCelsiusChange,
        handleFahrenheitChange: handleTemperatureFahrenheitChange,
        handleQualifierChange: handleTemperatureQualifierChange,
      },
      onClearForm: () => {
        temperatureState.clearForm();
        setDraft(encounterId, { temperature: undefined });
      },
    },
    heartbeat: {
      save: saveHandlers[VitalFieldNames.VitalHeartbeat],
      saveWithDto: handleSaveVital,
      delete: handleDeleteVital,
      isSaving: fieldSavingStates[VitalFieldNames.VitalHeartbeat] ?? false,
      isValid: heartbeatState.isValid,
      hasData: heartbeatState.hasData,
      current: (encounterVitals?.[VitalFieldNames.VitalHeartbeat] as VitalsHeartbeatObservationDTO[]) ?? [],
      historical: (historicalVitals?.[VitalFieldNames.VitalHeartbeat] as VitalsHeartbeatObservationDTO[]) ?? [],
      localState: {
        ...heartbeatState,
        handleValueChange: handleHeartbeatValueChange,
        handleQualifierChange: handleHeartbeatQualifierChange,
      },
      onClearForm: () => {
        heartbeatState.clearForm();
        setDraft(encounterId, { heartbeat: undefined });
      },
    },
    respirationRate: {
      save: saveHandlers[VitalFieldNames.VitalRespirationRate],
      saveWithDto: handleSaveVital,
      delete: handleDeleteVital,
      isSaving: fieldSavingStates[VitalFieldNames.VitalRespirationRate] ?? false,
      isValid: respirationRateState.isValid,
      hasData: respirationRateState.hasData,
      current: (encounterVitals?.[VitalFieldNames.VitalRespirationRate] as VitalsRespirationRateObservationDTO[]) ?? [],
      historical:
        (historicalVitals?.[VitalFieldNames.VitalRespirationRate] as VitalsRespirationRateObservationDTO[]) ?? [],
      localState: {
        ...respirationRateState,
        handleValueChange: handleRespirationRateValueChange,
      },
      onClearForm: () => {
        respirationRateState.clearForm();
        setDraft(encounterId, { respirationRate: undefined });
      },
    },
    bloodPressure: {
      save: saveHandlers[VitalFieldNames.VitalBloodPressure],
      saveWithDto: handleSaveVital,
      delete: handleDeleteVital,
      isSaving: fieldSavingStates[VitalFieldNames.VitalBloodPressure] ?? false,
      isValid: bloodPressureState.isValid,
      hasData: bloodPressureState.hasData,
      current: (encounterVitals?.[VitalFieldNames.VitalBloodPressure] as VitalsBloodPressureObservationDTO[]) ?? [],
      historical: (historicalVitals?.[VitalFieldNames.VitalBloodPressure] as VitalsBloodPressureObservationDTO[]) ?? [],
      localState: {
        ...bloodPressureState,
        handleSystolicChange: handleBloodPressureSystolicChange,
        handleDiastolicChange: handleBloodPressureDiastolicChange,
        handleQualifierChange: handleBloodPressureQualifierChange,
      },
      onClearForm: () => {
        bloodPressureState.clearForm();
        setDraft(encounterId, { bloodPressure: undefined });
      },
    },
    oxygenSat: {
      save: saveHandlers[VitalFieldNames.VitalOxygenSaturation],
      saveWithDto: handleSaveVital,
      delete: handleDeleteVital,
      isSaving: fieldSavingStates[VitalFieldNames.VitalOxygenSaturation] ?? false,
      isValid: oxygenSatState.isValid,
      hasData: oxygenSatState.hasData,
      current: (encounterVitals?.[VitalFieldNames.VitalOxygenSaturation] as VitalsOxygenSatObservationDTO[]) ?? [],
      historical: (historicalVitals?.[VitalFieldNames.VitalOxygenSaturation] as VitalsOxygenSatObservationDTO[]) ?? [],
      localState: {
        ...oxygenSatState,
        handleValueChange: handleOxygenSatValueChange,
        handleQualifierChange: handleOxygenSatQualifierChange,
      },
      onClearForm: () => {
        oxygenSatState.clearForm();
        setDraft(encounterId, { oxygenSat: undefined });
      },
    },
    weight: {
      save: saveHandlers[VitalFieldNames.VitalWeight],
      saveWithDto: handleSaveVital,
      delete: handleDeleteVital,
      isSaving: fieldSavingStates[VitalFieldNames.VitalWeight] ?? false,
      isValid: weightState.isValid,
      hasData: weightState.hasData,
      current: (encounterVitals?.[VitalFieldNames.VitalWeight] as VitalsWeightObservationDTO[]) ?? [],
      historical: (historicalVitals?.[VitalFieldNames.VitalWeight] as VitalsWeightObservationDTO[]) ?? [],
      localState: {
        ...weightState,
        handleKgInput: handleWeightKgInput,
        handleLbsInput: handleWeightLbsInput,
      },
      onClearForm: () => {
        weightState.clearForm();
        setDraft(encounterId, { weight: undefined });
      },
    },
    height: {
      save: saveHandlers[VitalFieldNames.VitalHeight],
      saveWithDto: handleSaveVital,
      delete: handleDeleteVital,
      isSaving: fieldSavingStates[VitalFieldNames.VitalHeight] ?? false,
      isValid: heightState.isValid,
      hasData: heightState.hasData,
      current: (encounterVitals?.[VitalFieldNames.VitalHeight] as VitalsHeightObservationDTO[]) ?? [],
      historical: (historicalVitals?.[VitalFieldNames.VitalHeight] as VitalsHeightObservationDTO[]) ?? [],
      localState: {
        ...heightState,
        handleCmChange: handleHeightCmChange,
        handleInchesChange: handleHeightInchesChange,
        handleFeetChange: handleHeightFeetChange,
        handleInchRemainderChange: handleHeightInchRemainderChange,
      },
      onClearForm: () => {
        heightState.clearForm();
        setDraft(encounterId, { height: undefined });
      },
    },
    bmi: {
      current: (encounterVitals?.[VitalFieldNames.VitalBMI] as VitalsBMIObservationDTO[]) ?? [],
      historical: (historicalVitals?.[VitalFieldNames.VitalBMI] as VitalsBMIObservationDTO[]) ?? [],
      delete: handleDeleteVital,
    },
    vision: {
      save: saveHandlers[VitalFieldNames.VitalVision],
      saveWithDto: handleSaveVital,
      delete: handleDeleteVital,
      isSaving: fieldSavingStates[VitalFieldNames.VitalVision] ?? false,
      isValid: visionState.isValid,
      hasData: visionState.hasData,
      current: (encounterVitals?.[VitalFieldNames.VitalVision] as VitalsVisionObservationDTO[]) ?? [],
      historical: (historicalVitals?.[VitalFieldNames.VitalVision] as VitalsVisionObservationDTO[]) ?? [],
      localState: {
        ...visionState,
        handleLeftEyeChange: handleVisionLeftEyeChange,
        handleRightEyeChange: handleVisionRightEyeChange,
        handleBothEyesChange: handleVisionBothEyesChange,
        handleVisionOptionChange: handleVisionOptionChange,
      },
      dotState: dotVisionState,
      saveDot: handleSaveDot,
      isSavingDot,
      onClearForm: () => {
        visionState.clearForm();
        setDraft(encounterId, { vision: undefined });
      },
    },
    lmp: {
      save: saveHandlers[VitalFieldNames.VitalLastMenstrualPeriod],
      saveWithDto: handleSaveVital,
      delete: handleDeleteVital,
      isSaving: fieldSavingStates[VitalFieldNames.VitalLastMenstrualPeriod] ?? false,
      isValid: lmpState.isValid,
      hasData: lmpState.hasData,
      current:
        (encounterVitals?.[VitalFieldNames.VitalLastMenstrualPeriod] as VitalsLastMenstrualPeriodObservationDTO[]) ??
        [],
      historical:
        (historicalVitals?.[VitalFieldNames.VitalLastMenstrualPeriod] as VitalsLastMenstrualPeriodObservationDTO[]) ??
        [],
      localState: {
        ...lmpState,
        handleDateChange: handleLMPDateChange,
        handleUnsureChange: handleLMPUnsureChange,
      },
      onClearForm: () => {
        lmpState.clearForm();
        setDraft(encounterId, { lmp: undefined });
      },
    },
  };

  const canSaveAll =
    temperatureState.hasData ||
    heartbeatState.hasData ||
    respirationRateState.hasData ||
    bloodPressureState.hasData ||
    oxygenSatState.hasData ||
    (weightState.hasData && !weightState.isPatientRefusedSelected) ||
    heightState.hasData ||
    visionState.hasData ||
    dotVisionState.hasData ||
    lmpState.hasData;

  const clearAllDrafts = useCallback(() => {
    temperatureState.clearForm();
    heartbeatState.clearForm();
    respirationRateState.clearForm();
    bloodPressureState.clearForm();
    oxygenSatState.clearForm();
    weightState.clearForm();
    heightState.clearForm();
    visionState.clearForm();
    lmpState.clearForm();
    clearDraft(encounterId);
  }, [
    temperatureState,
    heartbeatState,
    respirationRateState,
    bloodPressureState,
    oxygenSatState,
    weightState,
    heightState,
    visionState,
    lmpState,
    clearDraft,
    encounterId,
  ]);

  const abnormalVitalsValues = useMemo(() => getAbnormalVitals(encounterVitals), [encounterVitals]);

  return {
    data: {
      encounter: encounterVitals,
      historical: historicalVitals,
      isLoading: encounterVitalsLoading,
    },
    fields,
    saveAll: handleAddAllVitals,
    isSavingAll: isBatchSaving,
    canSaveAll,
    clearAllDrafts,
    refs: vitalCardRefs,
    abnormalVitalsValues,
  };
};
