import { ErxSearchMedicationsResponse } from '@oystehr/sdk';
import { create } from 'zustand';
import { ExtractObjectType } from './appointment/appointment.queries';

interface AiSuggestionPrefillState {
  medicationPrefill: ExtractObjectType<ErxSearchMedicationsResponse> | null;
  setMedicationPrefill: (med: ExtractObjectType<ErxSearchMedicationsResponse>) => void;
  clearMedicationPrefill: () => void;
}

export const useAiSuggestionPrefillStore = create<AiSuggestionPrefillState>()((set) => ({
  medicationPrefill: null,
  setMedicationPrefill: (med) => set({ medicationPrefill: med }),
  clearMedicationPrefill: () => set({ medicationPrefill: null }),
}));
