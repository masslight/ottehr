export interface UploadDotVisionDocumentInput {
  appointmentID: string;
  z3URL: string;
  title?: string;
}

export interface UploadDotVisionDocumentOutput {
  documentRefId: string;
  url: string;
  title: string;
}
