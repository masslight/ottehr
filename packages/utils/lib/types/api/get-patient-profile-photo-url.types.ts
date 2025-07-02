export interface GetOrUploadPatientProfilePhotoZambdaInput {
  patientID: string;
  action: 'upload' | 'download';
  z3PhotoUrl?: string;
}

export interface GetOrUploadPatientProfilePhotoZambdaResponse {
  z3ImageUrl: string;
  presignedImageUrl: string;
}
