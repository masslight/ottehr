import { DocumentReference } from 'fhir/r4b';
import { ApprovedPatientEducationIcdCode, PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL } from 'utils';

/**
 * Pull the ICD-10-CM codes attached to an approved-patient-education DocumentReference.
 * The codes live inside a nested extension at PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
 * with each `icdCode` sub-extension carrying a `valueCoding` of `{ system, code, display }`.
 *
 * Callers that only need the raw code strings should `.map((c) => c.code)` on the result.
 */
export function extractApprovedEducationIcdCodes(docRef: DocumentReference): ApprovedPatientEducationIcdCode[] {
  const ext = (docRef.extension || []).find((e) => e.url === PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL);
  if (!ext?.extension) return [];
  return ext.extension
    .map((e) => e.valueCoding)
    .filter((c): c is NonNullable<typeof c> => !!c?.code)
    .map((c) => ({ code: c.code!, display: c.display ?? '' }));
}
