export interface PatientNoteDTO {
  resourceId?: string;
  patientId: string;
  text: string;
  authorId: string;
  authorName: string;
  lastUpdated?: string;
  edited?: boolean;
}

export interface CreatePatientNoteRequest {
  patientId: string;
  text: string;
}

export interface CreatePatientNoteInput {
  note: CreatePatientNoteRequest;
}

export interface UpdatePatientNoteRequest {
  resourceId: string;
  patientId: string;
  text: string;
}

export interface UpdatePatientNoteInput {
  note: UpdatePatientNoteRequest;
}

export interface GetPatientNotesInput {
  patientId: string;
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
