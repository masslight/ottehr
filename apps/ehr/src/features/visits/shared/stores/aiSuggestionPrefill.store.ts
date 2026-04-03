import { ErxSearchMedicationsResponse } from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { create } from 'zustand';
import { ExtractObjectType } from './appointment/appointment.queries';

export interface MedicationPrefillData {
  medication: ExtractObjectType<ErxSearchMedicationsResponse>;
  dose?: string;
  date?: DateTime;
}

interface AiSuggestionPrefillState {
  medicationPrefill: MedicationPrefillData | null;
  setMedicationPrefill: (data: MedicationPrefillData) => void;
  clearMedicationPrefill: () => void;
}

export const useAiSuggestionPrefillStore = create<AiSuggestionPrefillState>()((set) => ({
  medicationPrefill: null,
  setMedicationPrefill: (med) => set({ medicationPrefill: med }),
  clearMedicationPrefill: () => set({ medicationPrefill: null }),
}));
