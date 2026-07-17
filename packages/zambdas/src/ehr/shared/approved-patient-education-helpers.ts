import { DocumentReference } from 'fhir/r4b';
import {
  ApprovedPatientEducationIcdCode,
  normalizePatientEducationLanguage,
  PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE,
  PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
} from 'utils';

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

/**
 * Find the incoming ICD codes that are already used by another approved-education
 * DocumentReference of the same language as `target`. English and Spanish PDFs for the same
 * ICD code coexist, mirroring the replace-on-save behavior in save-approved-patient-education.
 */
export function findConflictingApprovedEducationIcdCodes(
  target: DocumentReference,
  others: DocumentReference[],
  incomingIcdCodes: ApprovedPatientEducationIcdCode[]
): string[] {
  const targetLanguage = normalizePatientEducationLanguage(target.content?.[0]?.attachment?.language);
  const incomingIcdSet = new Set(incomingIcdCodes.map((c) => c.code));
  const conflictingCodes = new Set<string>();
  for (const other of others) {
    if (other.id === target.id) continue;
    if (!(other.type?.coding ?? []).some((c) => c.code === PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE)) continue;
    if (normalizePatientEducationLanguage(other.content?.[0]?.attachment?.language) !== targetLanguage) continue;
    for (const { code } of extractApprovedEducationIcdCodes(other)) {
      if (incomingIcdSet.has(code)) conflictingCodes.add(code);
    }
  }
  return Array.from(conflictingCodes);
}
