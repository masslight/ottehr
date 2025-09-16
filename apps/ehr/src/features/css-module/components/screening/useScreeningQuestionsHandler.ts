import { useCallback, useMemo } from 'react';
import {
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
  shouldWaitForNote,
} from 'utils';

type FieldValue = string | boolean | [string | null, string | null] | null;

type ObservationPayload = {
  field: string;
  value?: string | null;
  note?: string;
  resourceId?: string;
};

interface ScreeningQuestionsHandlerDeps {
  chartData?: GetChartDataResponse;
  debounce: (fn: () => void, key?: string) => void;
  currentFormValues: Record<string, FieldValue>;
  deleteObservation: (observation: ObservationDTO, fieldId: string) => Promise<void>;
  saveObservation: (observation: ObservationDTO, fieldId: string) => Promise<void>;
  getUiData: (fhirField: string) => ObservationDTO | undefined;
}

export const useScreeningQuestionsHandler = (
  deps: ScreeningQuestionsHandlerDeps
): {
  handleFieldChange: (fieldId: string, value: FieldValue) => void;
  getInitialValues: () => Record<string, FieldValue>;
  shouldShowNoteField: (noteFieldId: string, parentValue: string) => boolean;
  initialValues: Record<string, FieldValue>;
} => {
  const { chartData, debounce, deleteObservation, saveObservation, getUiData } = deps;

  const getCurrentObservation = useCallback(
    (fhirField: string): ObservationDTO | undefined => {
      return chartData?.observations?.find((obs: ObservationDTO) => obs.field === fhirField);
    },
    [chartData]
  );

  const handleMainFieldChange = useCallback(
    async (field: Field, value: FieldValue): Promise<undefined> => {
      if (!field.fhirField) {
        console.warn(`No backend field specified for: ${field.id}`);
        return;
      }

      const fhirValue = getFhirValueOrFallback(field, value as string);

      // Check if we need to wait for note to be filled
      if (shouldWaitForNote(field, value as string)) {
        return;
      }

      const currentObs = getUiData(field.fhirField);

      // current observation keep resource Id, in that case the resource will be updated.
      // for the new observation, we send only field and value.
      const baseObservation = currentObs
        ? { ...currentObs, value: fhirValue }
        : { field: field.fhirField, value: fhirValue };

      const observation = baseObservation as ObservationPayload;

      // If field has noteField but it shouldn't be visible for this value, remove note
      if (field.noteField && field.noteField.conditionalValue) {
        const shouldShowNote = field.noteField.conditionalValue === fhirValue;
        if (!shouldShowNote && 'note' in observation && observation.note !== undefined) {
          delete observation.note;
        }
      }

      if (observation.value === null) {
        if (currentObs) {
          await deleteObservation(currentObs, field.id);
        }
      } else {
        const saveAction = (): Promise<void> => saveObservation(observation as ObservationDTO, field.id);
        await saveAction();
      }
    },
    [deleteObservation, getUiData, saveObservation]
  );

  const processNoteFieldChange = useCallback(
    async (parentField: Field, noteField: NoteField, value: string): Promise<void> => {
      console.log('🔍 processNoteFieldChange called:', {
        parentFieldId: parentField.id,
        noteFieldId: noteField.id,
        valueParameter: value,
      });

      if (!noteField.fhirField) {
        console.warn(`No fhir field specified for note: ${noteField.id}`);
        return;
      }

      const currentObs = getUiData(noteField.fhirField);
      console.log('🔍 Current observation:', currentObs);

      if (!value && parentField.canDelete) {
        if (currentObs) {
          await deleteObservation(currentObs, noteField.id);
        }
        return;
      }

      const parentFieldValue = deps.currentFormValues[parentField.id];
      const correctFhirValue = getFhirValueOrFallback(parentField, parentFieldValue as string);

      const observation = noteField.conditionalValue
        ? ({
            ...currentObs,
            field: noteField.fhirField,
            value: correctFhirValue,
            note: value,
          } as ObservationPayload)
        : ({
            ...currentObs,
            field: noteField.fhirField,
            note: value,
          } as ObservationPayload);

      await saveObservation(observation as ObservationDTO, noteField.id);
    },
    [getUiData, saveObservation, deleteObservation, deps.currentFormValues]
  );

  const handleFieldChange = useCallback(
    async (fieldId: string, value: FieldValue): Promise<void> => {
      const field = getFieldById(fieldId);
      const noteFieldInfo = getNoteFieldById(fieldId);
      const mainFieldId = field?.id || noteFieldInfo?.field?.id; // used in debounce because base field and its note are connected and share debounce key

      if (!mainFieldId) {
        console.warn(`Field not found in config: ${fieldId}`);
        return;
      }

      if (field) {
        const shouldDebounce = field.noteField !== undefined;

        if (shouldDebounce) {
          const saveAction = (): Promise<void> => {
            return handleMainFieldChange(field, value);
          };
          debounce(saveAction, mainFieldId);
        } else {
          const executeMainFieldChange = async (): Promise<void> => {
            await handleMainFieldChange(field, value);
          };
          void executeMainFieldChange();
        }
      } else if (noteFieldInfo) {
        const saveAction = (): Promise<void> => {
          return processNoteFieldChange(noteFieldInfo.field, noteFieldInfo.noteField, value as string);
        };
        debounce(saveAction, mainFieldId);
      }
    },
    [debounce, handleMainFieldChange, processNoteFieldChange]
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
            if ('note' in observation && typeof observation.note === 'string') {
              values[field.noteField.id] = observation.note;
            }
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
