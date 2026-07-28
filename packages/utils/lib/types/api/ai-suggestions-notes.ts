export type AISuggestionNotesInput =
  | {
      type: 'missing-hpi';
      hpi?: string;
    }
  | {
      type: 'note-review';
      appointmentId?: string;
      encounterId?: string;
    };

export interface AISuggestionNotes {
  suggestions: string[];
}
