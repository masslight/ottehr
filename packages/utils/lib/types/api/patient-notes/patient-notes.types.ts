export interface PatientNoteDTO {
  resourceId?: string;
  patientId: string;
  text: string;
  authorId: string;
  authorName: string;
  lastUpdated?: string;
  edited?: boolean;
}

export interface SavePatientNoteRequest {
  resourceId?: string;
  patientId: string;
  text: string;
}

export interface GetPatientNotesInput {
  patientId: string;
}

export interface GetPatientNotesOutput {
  notes: PatientNoteDTO[];
}

export interface SavePatientNoteInput {
  note: SavePatientNoteRequest;
}

export interface SavePatientNoteOutput {
  note: PatientNoteDTO;
}

export interface DeletePatientNoteInput {
  resourceId: string;
}
