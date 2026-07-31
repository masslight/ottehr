import { PatientEducationLanguage } from '../data/patient-education.types';

export interface ApprovedPatientEducationIcdCode {
  code: string;
  display: string;
}

export interface ApprovedPatientEducationItem {
  documentReferenceId: string;
  title: string;
  icdCodes: ApprovedPatientEducationIcdCode[];
  pdfPresignedUrl: string;
  // Language of this approved PDF. Legacy items created before language support are treated as 'en'.
  language: PatientEducationLanguage;
}

export interface ListApprovedPatientEducationOutput {
  items: ApprovedPatientEducationItem[];
}

export interface SaveApprovedPatientEducationInput {
  pdfBase64: string;
  title: string;
  icdCodes: ApprovedPatientEducationIcdCode[];
  // Language of the PDF. Defaults to English when omitted. Replace-on-save only supersedes existing
  // approved PDFs of the SAME language, so EN and ES variants for a code coexist.
  language?: PatientEducationLanguage;
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

export interface UpdateApprovedPatientEducationCodesInput {
  documentReferenceId: string;
  icdCodes: ApprovedPatientEducationIcdCode[];
}

export interface UpdateApprovedPatientEducationCodesOutput {
  documentReferenceId: string;
}
