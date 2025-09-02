import { UseMutateAsyncFunction } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useMemo, useRef } from 'react';
import {
  ChartDataFields,
  DeleteChartDataResponse,
  Field,
  GetChartDataResponse,
  getFhirValueOrFallback,
  getFieldById,
  getNoteFieldById,
  getUiValueOrFallback,
  isNoteFieldConditional,
  NoteField,
  ObservationDTO,
  patientScreeningQuestionsConfig,
  SchoolWorkNoteExcuseDocFileDTO,
  shouldWaitForNote,
} from 'utils';
import { OystehrTelemedAPIClient } from '../../../../telemed/data/oystehrApi';

type FieldValue = string | boolean | [string | null, string | null] | null;

interface ScreeningQuestionsHandlerDeps {
  chartData?: GetChartDataResponse;
  updateObservation: (observation: ObservationDTO) => void;
  encounterId?: string;
  apiClient?: OystehrTelemedAPIClient | null;
  refetchChartData: () => Promise<void>;
  deleteChartData: UseMutateAsyncFunction<
    DeleteChartDataResponse,
    Error,
    ChartDataFields & { schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[] | undefined },
    unknown
  >;
  debounce: (fn: () => void) => void;
  setNavigationDisable: (state: Record<string, boolean>) => void;
  setFieldLoadingState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const useScreeningQuestionsHandler = (
  deps: ScreeningQuestionsHandlerDeps
): {
  handleFieldChange: (fieldId: string, value: FieldValue) => void;
  getInitialValues: () => Record<string, FieldValue>;
  shouldShowNoteField: (noteFieldId: string, parentValue: string) => boolean;
  initialValues: Record<string, FieldValue>;
} => {
  const pendingOperationsRef = useRef(new Set<string>());

  const {
    chartData,
    updateObservation,
    encounterId,
    apiClient,
    refetchChartData,
    deleteChartData,
    debounce,
    setFieldLoadingState,
  } = deps;

  /**
   * Refetch data only after all pending requests complete to avoid:
   * - Setting stale state from earlier requests
   * - Making redundant API calls during concurrent operations
   */ const refetchChartDataIfNotPendingRequests = useCallback(async (): Promise<void> => {
    if (pendingOperationsRef.current.size === 0) {
      await refetchChartData();
    }
  }, [refetchChartData]);

  const getCurrentObservation = useCallback(
    (fhirField: string): ObservationDTO | undefined => {
      return chartData?.observations?.find((obs: ObservationDTO) => obs.field === fhirField);
    },
    [chartData]
  );

  const setLoading = useCallback(
    (fieldId: string, isLoading: boolean): void => {
      setFieldLoadingState((prev) => ({
        ...prev,
        [fieldId]: isLoading,
      }));
    },
    [setFieldLoadingState]
  );

  const getFieldDisplayName = useCallback((fieldId: string): string => {
    const field = getFieldById(fieldId);
    if (field) return field.question;

    const noteFieldInfo = getNoteFieldById(fieldId);
    if (noteFieldInfo) return noteFieldInfo.noteField.label || noteFieldInfo.field.question;

    return fieldId;
  }, []);

  const applyOptimisticUpdate = useCallback(
    (observation: ObservationDTO): void => {
      updateObservation(observation);
    },
    [updateObservation]
  );

  const rollbackOptimisticUpdate = useCallback(
    (originalObservation: ObservationDTO | undefined): void => {
      if (originalObservation) {
        updateObservation(originalObservation);
      }
    },
    [updateObservation]
  );

  const saveObservation = useCallback(
    async (observation: ObservationDTO, fieldId: string): Promise<void> => {
      // Prevent duplicate operations
      if (pendingOperationsRef.current.has(fieldId)) {
        return;
      }

      pendingOperationsRef.current.add(fieldId);
      setLoading(fieldId, true);
      const originalObservation = getCurrentObservation(observation.field);
      applyOptimisticUpdate(observation);

      try {
        const result = await apiClient?.saveChartData?.({
          encounterId: encounterId || '',
          observations: [observation],
        });

        if (result?.chartData?.observations?.[0]) {
          updateObservation(result.chartData.observations[0]);
        }
      } catch (error) {
        console.error('Error saving observation:', error);
        const fieldDisplayName = getFieldDisplayName(fieldId);
        enqueueSnackbar(
          `An error occurred while saving the answer for question: "${fieldDisplayName}". Please try again.`,
          {
            variant: 'error',
          }
        );
        rollbackOptimisticUpdate(originalObservation);
      } finally {
        setLoading(fieldId, false);
        pendingOperationsRef.current.delete(fieldId);
      }
    },
    [
      setLoading,
      getCurrentObservation,
      applyOptimisticUpdate,
      apiClient,
      encounterId,
      updateObservation,
      getFieldDisplayName,
      rollbackOptimisticUpdate,
    ]
  );

  const deleteObservation = useCallback(
    async (observation: ObservationDTO, fieldId: string): Promise<DeleteChartDataResponse | null> => {
      if (pendingOperationsRef.current.has(fieldId)) {
        return null;
      }

      pendingOperationsRef.current.add(fieldId);
      setLoading(fieldId, true);

      return deleteChartData(
        { observations: [observation] },
        {
          onSuccess: async () => {
            setLoading(fieldId, false);
            pendingOperationsRef.current.delete(fieldId);
          },
          onError: () => {
            setLoading(fieldId, false);
            pendingOperationsRef.current.delete(fieldId);
          },
        }
      );
    },
    [deleteChartData, setLoading]
  );

  const handleMainFieldChange = useCallback(
    async (field: Field, value: FieldValue): Promise<void> => {
      if (!field.fhirField) {
        console.warn(`No backend field specified for: ${field.id}`);
        return;
      }

      const fhirValue = getFhirValueOrFallback(field, value as string);

      // Check if we need to wait for note to be filled
      if (shouldWaitForNote(field, value as string)) {
        return;
      }

      const currentObs = getCurrentObservation(field.fhirField);

      // current observation keep resource Id, in that case the resource will be updated.
      // for the new observation, we send only field and value.
      // so it's important to use resource Id when the new observation is created, we can use partial update or refetch chart data for this.
      const baseObservation = currentObs
        ? { ...currentObs, value: fhirValue }
        : { field: field.fhirField, value: fhirValue };

      const observation = baseObservation as Partial<ObservationDTO> & Record<string, unknown>;

      // If field has noteField but it shouldn't be visible for this value, remove note
      if (field.noteField && field.noteField.conditionalValue) {
        const shouldShowNote = field.noteField.conditionalValue === fhirValue;
        if (!shouldShowNote && 'note' in observation && observation.note !== undefined) {
          const observationWithNote = observation as ObservationDTO & { note?: string };
          delete observationWithNote.note;
        }
      }

      if (observation.value === null) {
        if (currentObs) {
          await deleteObservation(currentObs, field.id);
          await refetchChartDataIfNotPendingRequests();
        }
      } else {
        const saveAction = (): Promise<void> => saveObservation(observation as ObservationDTO, field.id);
        await saveAction();
        await refetchChartDataIfNotPendingRequests();
      }
    },
    [deleteObservation, getCurrentObservation, refetchChartDataIfNotPendingRequests, saveObservation]
  );

  // Process note field change
  const processNoteFieldChange = useCallback(
    async (parentField: Field, noteField: NoteField, value: string): Promise<void> => {
      if (!noteField.fhirField) {
        console.warn(`No fhir field specified for note: ${noteField.id}`);
        return;
      }

      const currentObs = getCurrentObservation(noteField.fhirField);

      // If value is empty and can be deleted
      if (!value && parentField.canDelete) {
        if (currentObs) {
          await deleteObservation(currentObs, noteField.id);
          await refetchChartDataIfNotPendingRequests();
        }
        return;
      }

      // checkbox value may have additional note, that's the noteField.conditionalValue case,
      // if it doesn't have conditional value, it's just a note field.
      const observation = noteField.conditionalValue
        ? {
            ...currentObs,
            field: noteField.fhirField,
            value: noteField.conditionalValue,
            note: value,
          }
        : {
            ...currentObs,
            field: noteField.fhirField,
            note: value,
          };

      await saveObservation(observation as ObservationDTO, noteField.id);
      await refetchChartDataIfNotPendingRequests();
    },
    [getCurrentObservation, saveObservation, deleteObservation, refetchChartDataIfNotPendingRequests]
  );

  // Handle note field change
  const handleNoteFieldChange = useCallback(
    (parentField: Field, noteField: NoteField, value: string): void => {
      const saveAction = (): Promise<void> => processNoteFieldChange(parentField, noteField, value);

      // Use debounce if specified in configuration
      if (parentField.debounced || noteField.type === 'textarea') {
        debounce(saveAction);
      } else {
        void saveAction();
      }
    },
    [processNoteFieldChange, debounce]
  );

  // Main field change handler
  const handleFieldChange = useCallback(
    (fieldId: string, value: FieldValue): void => {
      // Determine field type by configuration
      const field = getFieldById(fieldId);
      const noteFieldInfo = getNoteFieldById(fieldId);

      if (field) {
        void handleMainFieldChange(field, value);
      } else if (noteFieldInfo) {
        handleNoteFieldChange(noteFieldInfo.field, noteFieldInfo.noteField, value as string);
      } else {
        console.warn(`Field not found in config: ${fieldId}`);
      }
    },
    [handleMainFieldChange, handleNoteFieldChange]
  );

  // Get initial values from current data
  const getInitialValues = useCallback((): Record<string, FieldValue> => {
    const values: Record<string, FieldValue> = {};

    patientScreeningQuestionsConfig.fields.forEach((field) => {
      if (field.fhirField) {
        const observation = getCurrentObservation(field.fhirField);

        // Main field
        if (observation?.value) {
          values[field.id] = getUiValueOrFallback(field, observation.value as string) as FieldValue;
        }

        // Note field
        if (observation && 'note' in observation && observation.note && field.noteField) {
          // Check if note field should be shown
          const parentBackendValue = observation.value;
          if (!field.noteField.conditionalValue || field.noteField.conditionalValue === parentBackendValue) {
            const observationWithNote = observation as ObservationDTO & { note: string };
            values[field.noteField.id] = observationWithNote.note;
          }
        }
      }
    });

    return values;
  }, [getCurrentObservation]);

  // Get visibility of note field based on configuration
  const shouldShowNoteField = useCallback((noteFieldId: string, parentValue: string): boolean => {
    const noteFieldInfo = getNoteFieldById(noteFieldId);
    if (!noteFieldInfo) return false;

    const { noteField } = noteFieldInfo;
    return isNoteFieldConditional(noteField, parentValue);
  }, []);

  const initialValues = useMemo(() => getInitialValues(), [getInitialValues]);

  return {
    handleFieldChange,
    getInitialValues,
    shouldShowNoteField,
    initialValues,
  };
};
