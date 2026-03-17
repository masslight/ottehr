import { create } from 'zustand';

export interface AiCodeSuggestion {
  code: string;
  description: string;
  reason: string;
}

interface AiSuggestionsState {
  icdSuggestions: AiCodeSuggestion[] | undefined;
  cptSuggestions: AiCodeSuggestion[] | undefined;
  setIcdSuggestions: (suggestions: AiCodeSuggestion[] | undefined) => void;
  setCptSuggestions: (suggestions: AiCodeSuggestion[] | undefined) => void;
}

export const useAiSuggestionsStore = create<AiSuggestionsState>((set) => ({
  icdSuggestions: undefined,
  cptSuggestions: undefined,
  setIcdSuggestions: (suggestions) => set({ icdSuggestions: suggestions }),
  setCptSuggestions: (suggestions) => set({ cptSuggestions: suggestions }),
}));
