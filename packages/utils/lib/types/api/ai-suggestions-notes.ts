export interface ProcedureDetails {
  procedureDetails: string;
}

export interface AISuggestionNotesInput {
  type: string;
  hpi?: string;
  details?: ProcedureDetails;
  /**
   * `note-review` only. The visit to review. Neither the prompt nor the note content is supplied by
   * the caller: the zambda reads the practice-level prompt from the progress note config and
   * assembles the note itself, so a client can neither choose what the AI is asked nor what it sees.
   */
  appointmentId?: string;
  encounterId?: string;
}

export interface AISuggestionNotes {
  suggestions: string[];
}
