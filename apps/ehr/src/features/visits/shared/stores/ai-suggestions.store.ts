import { create } from 'zustand';

interface AiIcdSuggestion {
  code: string;
  description: string;
  reason: string;
}

interface AiSuggestionsState {
  icdSuggestions: AiIcdSuggestion[] | undefined;
  setIcdSuggestions: (suggestions: AiIcdSuggestion[] | undefined) => void;
}

export const useAiSuggestionsStore = create<AiSuggestionsState>((set) => ({
  icdSuggestions: undefined,
  setIcdSuggestions: (suggestions) => set({ icdSuggestions: suggestions }),
}));
