export interface ProcedureDetails {
  procedureDetails: string;
}

export interface AISuggestionNotesInput {
  type: string;
  hpi?: string;
  details?: ProcedureDetails;
  reviewPrompt?: string;
  noteDetails?: string;
}

export interface AISuggestionNotes {
  suggestions: string[];
}
