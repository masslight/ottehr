// Patient education can be produced in the patient's language. We support English and Spanish;
// the value maps directly to MedlinePlus Connect's `informationRecipient.languageCode.c` param and
// to FHIR `DocumentReference.content.attachment.language`.
export const PATIENT_EDUCATION_LANGUAGES = ['en', 'es'] as const;
export type PatientEducationLanguage = (typeof PATIENT_EDUCATION_LANGUAGES)[number];
export const PATIENT_EDUCATION_LANGUAGE_LABELS: Record<PatientEducationLanguage, string> = {
  en: 'English',
  es: 'Español',
};

export interface PatientEducationSection {
  content: string;
  patientTitle: string;
  icdCode: string;
  icdDescription: string;
}

export interface GeneratePatientEducationInput {
  icdCode: string;
  icdDescription: string;
  // Language to generate in; defaults to English when omitted (back-compat).
  language?: PatientEducationLanguage;
}

export interface GeneratePatientEducationOutput {
  content: string | null;
  error?: string;
  patientTitle?: string;
  icdCode: string;
  icdDescription: string;
  language: PatientEducationLanguage;
  links?: { title: string; url: string }[];
}

interface SavePatientEducationPdfBase {
  encounterId: string;
  patientId: string;
  title: string;
  // Language of this PDF; stored on the DocumentReference attachment.
  language?: PatientEducationLanguage;
}

export type SavePatientEducationPdfInput =
  | (SavePatientEducationPdfBase & { sections: PatientEducationSection[]; pdfBase64?: undefined })
  | (SavePatientEducationPdfBase & { pdfBase64: string; sections?: undefined });

export interface SavePatientEducationPdfOutput {
  documentReferenceId: string;
  presignedDownloadUrl: string;
}
