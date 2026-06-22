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

interface SavePatientEducationPdfBase {
  encounterId: string;
  patientId: string;
  title: string;
}

export type SavePatientEducationPdfInput =
  | (SavePatientEducationPdfBase & { sections: PatientEducationSection[]; pdfBase64?: undefined })
  | (SavePatientEducationPdfBase & { pdfBase64: string; sections?: undefined });

export interface SavePatientEducationPdfOutput {
  documentReferenceId: string;
  presignedDownloadUrl: string;
}
