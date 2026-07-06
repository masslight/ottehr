import { enqueueSnackbar } from 'notistack';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  calculateBMI,
  getAbnormalVitals,
  GetVitalsResponseData,
  isHeightVitalObservation,
  isWeightVitalObservation,
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
  refs: VitalCardRefs;
  abnormalVitalsValues: GetVitalsResponseData;
}

const getValidationErrorMessage = (state: VitalLocalState): string | undefined => {
  return 'validationErrorMessage' in state ? state.validationErrorMessage : undefined;
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
  const lmpState = useLMPLocalState();

  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [fieldSavingStates, setFieldSavingStates] = useState<Partial<Record<VitalFieldNames, boolean>>>({});

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

    // Save valid vitals
    if (validVitals.length > 0) {
      setIsBatchSaving(true);
      try {
        await batchSaveVitals(validVitals);
        const refetchResult = await refetchEncounterVitals();

        // Clear only the forms that were saved
        validVitalsEntries.forEach(([_, { state }]) => {
          state.clearForm();
        });

        const vitalText = validVitals.length === 1 ? 'vital' : 'vitals';
        enqueueSnackbar(`Successfully saved ${validVitals.length} ${vitalText}`, {
          variant: 'success',
        });

        // Auto-save BMI if height or weight was saved; isolated so a BMI failure doesn't flag the saved vitals.
        const savedFields = validVitals.map((v) => v.field);
        if (savedFields.includes(VitalFieldNames.VitalHeight) || savedFields.includes(VitalFieldNames.VitalWeight)) {
          try {
            const heightCm = refetchResult.data?.[VitalFieldNames.VitalHeight]?.[0]?.value;
            const weightKg = refetchResult.data?.[VitalFieldNames.VitalWeight]?.[0]?.value;
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
    batchSaveVitals,
    refetchEncounterVitals,
    saveBMI,
  ]);

  // Helper to create field save handler with validation
  const createFieldSaveHandler = useCallback(
    (field: VitalFieldNames, state: VitalLocalState, triggerBMI = false) =>
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
            // Derive BMI from the just-saved value plus the counterpart in state (no extra refetch);
            // isolated so a BMI failure doesn't flag the saved height/weight.
            if (triggerBMI) {
              const heightCm = isHeightVitalObservation(dto)
                ? dto.value
                : encounterVitals?.[VitalFieldNames.VitalHeight]?.[0]?.value;
              const weightKg = isWeightVitalObservation(dto)
                ? dto.value
                : encounterVitals?.[VitalFieldNames.VitalWeight]?.[0]?.value;
              try {
                await saveBMI(weightKg, heightCm);
              } catch {
                enqueueSnackbar('Error saving BMI data', { variant: 'error' });
              }
            }
            await refetchEncounterVitals();
            state.clearForm();
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
    [fieldSavingStates, saveVitals, refetchEncounterVitals, encounterVitals, saveBMI]
  );

  const saveHandlers = useMemo(() => {
    return {
      [VitalFieldNames.VitalTemperature]: createFieldSaveHandler(VitalFieldNames.VitalTemperature, temperatureState),
      [VitalFieldNames.VitalHeartbeat]: createFieldSaveHandler(VitalFieldNames.VitalHeartbeat, heartbeatState),
      [VitalFieldNames.VitalRespirationRate]: createFieldSaveHandler(
        VitalFieldNames.VitalRespirationRate,
        respirationRateState
      ),
      [VitalFieldNames.VitalBloodPressure]: createFieldSaveHandler(
        VitalFieldNames.VitalBloodPressure,
        bloodPressureState
      ),
      [VitalFieldNames.VitalOxygenSaturation]: createFieldSaveHandler(
        VitalFieldNames.VitalOxygenSaturation,
        oxygenSatState
      ),
      [VitalFieldNames.VitalWeight]: createFieldSaveHandler(VitalFieldNames.VitalWeight, weightState, true),
      [VitalFieldNames.VitalHeight]: createFieldSaveHandler(VitalFieldNames.VitalHeight, heightState, true),
      [VitalFieldNames.VitalVision]: createFieldSaveHandler(VitalFieldNames.VitalVision, visionState),
      [VitalFieldNames.VitalLastMenstrualPeriod]: createFieldSaveHandler(
        VitalFieldNames.VitalLastMenstrualPeriod,
        lmpState
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
      localState: temperatureState,
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
      localState: heartbeatState,
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
      localState: respirationRateState,
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
      localState: bloodPressureState,
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
      localState: oxygenSatState,
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
      localState: weightState,
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
      localState: heightState,
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
      localState: visionState,
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
      localState: lmpState,
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
    lmpState.hasData;

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
    refs: vitalCardRefs,
    abnormalVitalsValues,
  };
};
