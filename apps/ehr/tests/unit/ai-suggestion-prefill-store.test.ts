import { DateTime } from 'luxon';
import {
  MedicationPrefillData,
  useAiSuggestionPrefillStore,
} from 'src/features/visits/shared/stores/aiSuggestionPrefill.store';
import { afterEach, describe, expect, test } from 'vitest';

const mockMedication: MedicationPrefillData = {
  medication: { name: 'Amoxicillin', ndc: '12345', strength: '500mg' } as MedicationPrefillData['medication'],
  dose: '500mg',
  date: DateTime.fromISO('2024-06-15'),
};

const mockMedicationNoDose: MedicationPrefillData = {
  medication: { name: 'Aspirin', ndc: '67890', strength: '81mg' } as MedicationPrefillData['medication'],
};

afterEach(() => {
  useAiSuggestionPrefillStore.getState().clearMedicationPrefill();
});

describe('useAiSuggestionPrefillStore', () => {
  test('initializes with null medicationPrefill', () => {
    const state = useAiSuggestionPrefillStore.getState();
    expect(state.medicationPrefill).toBeNull();
  });

  test('setMedicationPrefill stores the data', () => {
    useAiSuggestionPrefillStore.getState().setMedicationPrefill(mockMedication);

    const state = useAiSuggestionPrefillStore.getState();
    expect(state.medicationPrefill).toEqual(mockMedication);
    expect(state.medicationPrefill?.medication.name).toBe('Amoxicillin');
    expect(state.medicationPrefill?.dose).toBe('500mg');
    expect(state.medicationPrefill?.date?.year).toBe(2024);
  });

  test('setMedicationPrefill works without optional dose and date', () => {
    useAiSuggestionPrefillStore.getState().setMedicationPrefill(mockMedicationNoDose);

    const state = useAiSuggestionPrefillStore.getState();
    expect(state.medicationPrefill).toEqual(mockMedicationNoDose);
    expect(state.medicationPrefill?.dose).toBeUndefined();
    expect(state.medicationPrefill?.date).toBeUndefined();
  });

  test('setMedicationPrefill overwrites previous data', () => {
    useAiSuggestionPrefillStore.getState().setMedicationPrefill(mockMedication);
    useAiSuggestionPrefillStore.getState().setMedicationPrefill(mockMedicationNoDose);

    const state = useAiSuggestionPrefillStore.getState();
    expect(state.medicationPrefill?.medication.name).toBe('Aspirin');
  });

  test('clearMedicationPrefill resets to null', () => {
    useAiSuggestionPrefillStore.getState().setMedicationPrefill(mockMedication);
    expect(useAiSuggestionPrefillStore.getState().medicationPrefill).not.toBeNull();

    useAiSuggestionPrefillStore.getState().clearMedicationPrefill();
    expect(useAiSuggestionPrefillStore.getState().medicationPrefill).toBeNull();
  });

  test('clearMedicationPrefill is idempotent when already null', () => {
    useAiSuggestionPrefillStore.getState().clearMedicationPrefill();
    expect(useAiSuggestionPrefillStore.getState().medicationPrefill).toBeNull();
  });
});
