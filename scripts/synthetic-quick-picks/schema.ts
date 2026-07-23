/**
 * Zod schema for ProcedureQuickPickData. Mirrors the TS interface in
 * packages/utils/lib/types/api/quick-picks.types.ts but enforces ValueSet
 * codes for the constrained fields so a typo in an example JSON fails fast
 * with the exact wrong value, instead of silently producing a quick pick
 * the EHR can't render.
 *
 * To add a new ValueSet code, update the corresponding enum here AND add
 * the entry to the matching config/oystehr/procedure-*.json file.
 */
import { z } from 'zod';

// ── ValueSet enums (mirror config/oystehr/procedure-*.json contains[] codes) ──

export const PROCEDURE_TYPES = [
  'laceration-repair',
  'wound-care',
  'splint-application',
  'abscess-drainage',
  'elbow-reduction',
  'burn-treatment',
  'foreign-body-removal',
  'nail-trephination',
  'tick-removal',
  'staple-removal',
  'iv-catheter-placement',
  'iv-fluid-administration',
  'im-medication-injection',
  'nebulizer-treatment',
  'oral-rehydration',
  'wart-treatment',
  'urinary-catheterization',
  'ear-lavage',
  'nasal-packing',
  'eye-irrigation',
  'nasal-lavage',
  'ekg',
  'x-ray',
] as const;

export const BODY_SITES = ['head', 'face', 'arm', 'leg', 'torso', 'genital', 'ear', 'nose', 'eye', 'other'] as const;
export const BODY_SIDES = ['left', 'right', 'midline', 'not-applicable'] as const;
export const TECHNIQUES = ['sterile', 'clean', 'aseptic', 'field'] as const;
export const SUPPLIES = [
  'suture-kit',
  'splint',
  'irrigation-syringe',
  'speculum',
  'forceps',
  'iv-kit',
  'other',
] as const;
export const MEDICATIONS_USED = ['none', 'topical', 'local', 'oral', 'iv', 'im'] as const;
export const COMPLICATIONS = ['none', 'bleeding', 'incomplete-removal', 'allergic-reaction', 'other'] as const;
export const PATIENT_RESPONSES = [
  'tolerated-well',
  'mild-distress',
  'severe-distress',
  'improved',
  'stable',
  'worsened',
] as const;
export const POST_INSTRUCTIONS = ['wound-care', 'fu-with-pcp', 'return-if-worsening', 'other'] as const;
export const TIME_SPENT = ['less-5-min', '5-10-min', '10-20-min', '20-30-min', 'greater-30-min'] as const;

const cptCodeSchema = z.object({
  code: z.string().min(1),
  display: z.string().min(1),
});

export const procedureQuickPickSchema = z.object({
  name: z.string().min(1),
  procedureType: z.enum(PROCEDURE_TYPES),
  cptCodes: z.array(cptCodeSchema).optional(),
  diagnoses: z.array(cptCodeSchema).optional(),
  bodySite: z.enum(BODY_SITES).optional(),
  otherBodySite: z.string().optional(),
  bodySide: z.enum(BODY_SIDES).optional(),
  technique: z.array(z.enum(TECHNIQUES)).optional(),
  medicationUsed: z.enum(MEDICATIONS_USED).optional(),
  suppliesUsed: z.array(z.enum(SUPPLIES)).optional(),
  otherSuppliesUsed: z.string().optional(),
  procedureDetails: z.string().optional(),
  specimenSent: z.boolean().optional(),
  complications: z.enum(COMPLICATIONS).optional(),
  otherComplications: z.string().optional(),
  patientResponse: z.enum(PATIENT_RESPONSES).optional(),
  postInstructions: z.array(z.enum(POST_INSTRUCTIONS)).optional(),
  otherPostInstructions: z.string().optional(),
  timeSpent: z.enum(TIME_SPENT).optional(),
  // Encounter-specific fields (consentObtained, performerType) and metadata
  // (id, documentedBy) are intentionally omitted — the EHR's
  // QUICK_PICK_APPLY_KEYS skips them when applying a pick to a new procedure.
});

export type ProcedureQuickPick = z.infer<typeof procedureQuickPickSchema>;

// ── Medical Condition Quick Picks ────────────────────────────────────────────

export const medicalConditionQuickPickSchema = z.object({
  display: z.string().min(1),
  code: z.string().optional(), // ICD-10
});

export type MedicalConditionQuickPick = z.infer<typeof medicalConditionQuickPickSchema>;

// ── Radiology Quick Picks ────────────────────────────────────────────────────

export const LATERALITY = ['LT', 'RT', '50'] as const; // 50 = bilateral

export const radiologyQuickPickSchema = z.object({
  name: z.string().min(1),
  cptCode: z.string().optional(),
  cptDisplay: z.string().optional(),
  studyName: z.string().optional(),
  laterality: z.enum(LATERALITY).optional(),
  clinicalHistory: z.string().optional(),
  stat: z.boolean().optional(),
  // consentObtained intentionally omitted — encounter-specific.
});

export type RadiologyQuickPick = z.infer<typeof radiologyQuickPickSchema>;

// ── Allergy Quick Picks ──────────────────────────────────────────────────────

export const allergyQuickPickSchema = z.object({
  name: z.string().min(1),
  // eRx allergen id (integer). Resolved from a name search via
  // oystehr.erx.searchAllergens — see bootstrap-allergy-examples.ts.
  allergyId: z.number().int().positive().optional(),
});

export type AllergyQuickPick = z.infer<typeof allergyQuickPickSchema>;

// ── Medication History Quick Picks ───────────────────────────────────────────

export const medicationHistoryQuickPickSchema = z.object({
  name: z.string().min(1),
  strength: z.string().optional(),
  // eRx medication id (integer). Resolved via oystehr.erx.searchMedications —
  // see bootstrap-medication-history-examples.ts.
  medicationId: z.number().int().positive().optional(),
});

export type MedicationHistoryQuickPick = z.infer<typeof medicationHistoryQuickPickSchema>;

// ── Immunization Quick Picks ─────────────────────────────────────────────────

const cptShape = z.object({ code: z.string(), display: z.string() });

export const immunizationQuickPickSchema = z.object({
  name: z.string().min(1),
  // vaccine.id is the FHIR Medication.id on the target project
  // (resolved via bootstrap-immunization-examples.ts).
  vaccine: z.object({ id: z.string(), name: z.string() }).optional(),
  dose: z.string().optional(), // numeric as string per EHR convention
  units: z.string().optional(), // e.g., "mL"
  route: z.string().optional(), // e.g., "IM"
  cvx: z.string().optional(), // CDC vaccine code (public)
  mvx: z.string().optional(), // CDC manufacturer code (per-shipment, usually blank)
  cptCodes: z.array(cptShape).optional(),
  manufacturer: z.string().optional(),
  instructions: z.string().optional(),
  associatedDx: z.string().optional(),
  // ndc / lot / expDate intentionally omitted — per-shipment, provider fills.
});

export type ImmunizationQuickPick = z.infer<typeof immunizationQuickPickSchema>;

// ── In-House Medication Quick Picks ──────────────────────────────────────────

export const inHouseMedicationQuickPickSchema = z.object({
  name: z.string().min(1),
  // medicationId is the FHIR Medication.id on the target project (resolved
  // via bootstrap-in-house-medication-examples.ts).
  medicationId: z.string().optional(),
  medicationName: z.string().optional(),
  dose: z.number().optional(),
  units: z.string().optional(),
  route: z.string().optional(),
  cptCodes: z.array(cptShape).optional(),
  manufacturer: z.string().optional(),
  instructions: z.string().optional(),
  associatedDx: z.string().optional(),
  // ndc / lotNumber / expDate omitted (per-shipment).
});

export type InHouseMedicationQuickPick = z.infer<typeof inHouseMedicationQuickPickSchema>;
