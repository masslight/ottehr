export interface PatientNoteDTO {
  resourceId?: string;
  patientId: string;
  text: string;
  authorId: string;
  authorName: string;
  lastUpdated?: string;
  edited?: boolean;
}

export interface GetPatientNotesInput {
  patientId: string;
}

export interface GetPatientNotesOutput {
  notes: PatientNoteDTO[];
}

export interface SavePatientNoteInput {
  note: PatientNoteDTO;
}

export interface SavePatientNoteOutput {
  note: PatientNoteDTO;
}

export interface DeletePatientNoteInput {
  resourceId: string;
}
