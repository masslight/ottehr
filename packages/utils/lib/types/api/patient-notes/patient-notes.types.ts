// Patient notes and task notes share these types and zambdas: a note belongs to a patient (patientId) or to a
// task (taskId).
export interface PatientNoteDTO {
  resourceId?: string;
  patientId: string;
  taskId?: string;
  text: string;
  authorId: string;
  authorName: string;
  // When the note was written.
  sent?: string;
  lastUpdated?: string;
  edited?: boolean;
  // Everyone who edited the note other than its author, in the order they first edited it.
  editorNames?: string[];
  // Task notes only: written by someone else and not yet read by the caller.
  isUnread?: boolean;
}

export interface CreatePatientNoteRequest {
  patientId?: string;
  taskId?: string;
  text: string;
}

export interface CreatePatientNoteInput {
  note: CreatePatientNoteRequest;
}

export interface UpdatePatientNoteRequest {
  resourceId: string;
  patientId?: string;
  taskId?: string;
  text: string;
}

export interface UpdatePatientNoteInput {
  note: UpdatePatientNoteRequest;
}

export interface GetPatientNotesInput {
  patientId?: string;
  // Task notes: every note on these tasks, newest first, in one page.
  taskIds?: string[];
  offset?: number;
  pageSize?: number;
}

export interface GetPatientNotesOutput {
  notes: PatientNoteDTO[];
  hasMore: boolean;
}

export interface GetPatientNotesCountInput {
  patientId: string;
}

export interface GetPatientNotesCountOutput {
  count: number;
}

export interface SavePatientNoteOutput {
  note: PatientNoteDTO;
}

export interface DeletePatientNoteInput {
  resourceId: string;
}

export interface MarkTaskNotesReadInput {
  taskId: string;
}
