export interface GetPatientMedicalRecordInput {
  patientId: string;
}

export interface GetPatientMedicalRecordOutput {
  // Presigned URL for the zip archive; empty string when the patient has no documents.
  downloadUrl: string;
  fileName: string;
  documentCount: number;
}
