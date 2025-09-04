import { patientScreeningQuestionsConfig } from '../../../main';
import { HistorySourceKeys, historySourceLabels, RecentVisitKeys, recentVisitLabels } from './constants';
import { Field, NoteField, ObservationDTO } from './types';

export function getHistorySourceLabel(key: HistorySourceKeys): string {
  return historySourceLabels[key];
}

export function getRecentVisitLabel(key: RecentVisitKeys): string {
  return recentVisitLabels[key];
}

export const getFhirValueOrFallback = (field: Field, uiValue: string): ObservationDTO['value'] => {
  const option = field.options?.find((opt) => opt.value === uiValue);
  return (option?.fhirValue || uiValue) as ObservationDTO['value'];
};

export const getUiValueOrFallback = (field: Field, fhirValue: string): string => {
  const option = field.options?.find((opt) => opt.fhirValue === fhirValue);
  return option?.value || fhirValue;
};

export const getFieldByFhirField = (fhirField: string): Field | undefined => {
  return patientScreeningQuestionsConfig.fields.find(
    (field: Field) => field.fhirField === fhirField || field.noteField?.fhirField === fhirField
  );
};

export const getFieldById = (fieldId: string): Field | undefined => {
  return patientScreeningQuestionsConfig.fields.find((field: Field) => field.id === fieldId);
};

export const getNoteFieldById = (noteFieldId: string): { field: Field; noteField: NoteField } | undefined => {
  for (const field of patientScreeningQuestionsConfig.fields) {
    if (field.noteField?.id === noteFieldId) {
      return { field, noteField: field.noteField };
    }
  }
  return undefined;
};

export const shouldWaitForNote = (field: Field, value: string): boolean => {
  return field.conditionalSave?.waitForNote === getFhirValueOrFallback(field, value);
};

export const isNoteFieldConditional = (noteField: NoteField, parentValue: string): boolean => {
  return noteField.conditionalValue ? noteField.conditionalValue === parentValue : true;
};
