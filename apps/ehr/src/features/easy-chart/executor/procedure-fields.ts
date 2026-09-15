// The procedure fields a quick-pick pre-fills, and which of them need their own verification.
//
// A provider says four words — "I did a laceration repair" — and the practice's quick-pick fills ten
// fields. Three of them are not descriptive at all:
//
//   complications     typically pre-filled "none"      → a clinical claim
//   patientResponse   typically "tolerated well"       → a clinical claim
//   timeSpent         feeds billing                    → a billing claim
//
// Under per-ITEM provenance one confirm click would accept all ten. So each template-filled field
// carries its own "default, verify" marker and its own confirm, and editing a field counts as
// reviewing it.

/** Fields shown under a procedure, in the order the procedure form uses. */
export const PROCEDURE_REVIEW_FIELDS = [
  'bodySite',
  'bodySide',
  'technique',
  'suppliesUsed',
  'medicationUsed',
  'procedureDetails',
  'specimenSent',
  'complications',
  'patientResponse',
  'postInstructions',
  'timeSpent',
  'performerType',
  'documentedBy',
  'consentObtained',
] as const;

export type ProcedureReviewField = (typeof PROCEDURE_REVIEW_FIELDS)[number];

const LABELS: Record<ProcedureReviewField, string> = {
  bodySite: 'Body site',
  bodySide: 'Side',
  technique: 'Technique',
  suppliesUsed: 'Supplies used',
  medicationUsed: 'Medication used',
  procedureDetails: 'Details',
  specimenSent: 'Specimen sent',
  complications: 'Complications',
  patientResponse: 'Patient response',
  postInstructions: 'Post instructions',
  timeSpent: 'Time spent',
  performerType: 'Performed by',
  documentedBy: 'Documented by',
  consentObtained: 'Consent obtained',
};

export function procedureFieldLabel(field: string): string {
  return LABELS[field as ProcedureReviewField] ?? field;
}
