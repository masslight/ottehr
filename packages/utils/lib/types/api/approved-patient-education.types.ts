export interface ApprovedPatientEducationIcdCode {
  code: string;
  display: string;
}

export interface ApprovedPatientEducationItem {
  documentReferenceId: string;
  title: string;
  icdCodes: ApprovedPatientEducationIcdCode[];
  pdfPresignedUrl: string;
}

export interface ListApprovedPatientEducationOutput {
  items: ApprovedPatientEducationItem[];
}

export interface SaveApprovedPatientEducationInput {
  pdfBase64: string;
  title: string;
  icdCodes: ApprovedPatientEducationIcdCode[];
}

export interface SaveApprovedPatientEducationOutput {
  documentReferenceId: string;
  replacedDocumentReferenceIds: string[];
}

export interface DeleteApprovedPatientEducationInput {
  documentReferenceId: string;
}

export interface DeleteApprovedPatientEducationOutput {
  success: true;
}
