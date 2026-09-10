export interface UploadPatientConditionPhotoInput {
  appointmentID: string;
  z3URL: string;
  title?: string;
  mimeType?: string;
}

export interface UploadPatientConditionPhotoOutput {
  documentRefId: string;
  url: string;
}

export interface DeletePatientConditionPhotoInput {
  action: 'delete';
  appointmentID: string;
  documentReferenceId: string;
}

export interface DeletePatientConditionPhotoOutput {
  documentRefId: string;
}
