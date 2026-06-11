// Patient education can be produced in the patient's language. We support English and Spanish;
// the value maps directly to MedlinePlus Connect's `informationRecipient.languageCode.c` param and
// to FHIR `DocumentReference.content.attachment.language`.
export type PatientEducationLanguage = 'en' | 'es';
export const PATIENT_EDUCATION_LANGUAGES: PatientEducationLanguage[] = ['en', 'es'];

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
  // Language of this PDF; stored on the DocumentReference attachment and used to pair EN/ES siblings.
  language?: PatientEducationLanguage;
  // The sibling-language document this is the translation of, so the two versions can be grouped.
  relatedDocumentReferenceId?: string;
}

export type SavePatientEducationPdfInput =
  | (SavePatientEducationPdfBase & { sections: PatientEducationSection[]; pdfBase64?: undefined })
  | (SavePatientEducationPdfBase & { pdfBase64: string; sections?: undefined });

export interface SavePatientEducationPdfOutput {
  documentReferenceId: string;
  presignedDownloadUrl: string;
}
