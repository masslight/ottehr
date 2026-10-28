export interface PatientNoteDTO {
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
  noteIds: string[];
}
