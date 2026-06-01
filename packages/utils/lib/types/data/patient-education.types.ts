export interface PatientEducationSection {
  content: string;
  patientTitle: string;
  icdCode: string;
  icdDescription: string;
}

export interface GeneratePatientEducationInput {
  icdCode: string;
  icdDescription: string;
}

export interface GeneratePatientEducationOutput {
  content: string | null;
  error?: string;
  patientTitle?: string;
  icdCode: string;
  icdDescription: string;
  links?: { title: string; url: string }[];
}

export interface SavePatientEducationPdfInput {
  encounterId: string;
  patientId: string;
  sections: PatientEducationSection[];
  title: string;
}

export interface SavePatientEducationPdfOutput {
  documentReferenceId: string;
  presignedDownloadUrl: string;
}
