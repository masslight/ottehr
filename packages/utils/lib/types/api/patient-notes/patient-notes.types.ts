export interface NoteDTO {
  resourceId?: string;
  patientId: string;
  taskId?: string;
  text: string;
  authorId: string;
  authorName: string;
  sent?: string;
  lastUpdated?: string;
  edited?: boolean;
  editorNames?: string[];
  isUnread?: boolean;
}

export interface CreateNoteRequest {
  patientId?: string;
  taskId?: string;
  text: string;
}

export interface CreateNoteInput {
  note: CreateNoteRequest;
}

export interface UpdateNoteRequest {
  resourceId: string;
  patientId?: string;
  taskId?: string;
  text: string;
}

export interface UpdateNoteInput {
  note: UpdateNoteRequest;
}

export interface GetNotesInput {
  patientId?: string;
  taskIds?: string[];
  offset?: number;
  pageSize?: number;
}

export interface GetNotesOutput {
  notes: NoteDTO[];
  hasMore: boolean;
}

export interface GetPatientNotesCountInput {
  patientId: string;
}

export interface GetPatientNotesCountOutput {
  count: number;
}

export interface SaveNoteOutput {
  note: NoteDTO;
}

export interface DeleteNoteInput {
  resourceId: string;
}

export interface MarkTaskNotesReadInput {
  taskId: string;
  noteIds: string[];
}
