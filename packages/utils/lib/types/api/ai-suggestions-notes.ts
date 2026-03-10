export interface ProcedureDetails {
  procedureDetails: string;
}

export interface AISuggestionNotesInput {
  type: string;
  hpi?: string;
  details?: ProcedureDetails;
}

export interface AISuggestionNotes {
  suggestions: string[];
}
