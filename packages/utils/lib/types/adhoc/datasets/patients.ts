// Patients dataset (one row per patient seen in range). Zod is the single source of truth: TS types,
// response validation, prompt schema, UI checkboxes, and endpoint input flags all derive from the
// objects below.
import { z } from 'zod';
import { AdHocLayerMap, DatasetInput, datasetInputSchema, datasetRowSchema, LayerRowFields } from './dataset';

export const PatientBaseRowSchema = z.object({
  // --- Patient ---
  patientId: z.string().describe('Patient id; link href="/patient/"+patientId. Count UNIQUE patients.'),
  firstName: z.string().describe('Patient first name.'),
  lastName: z.string().describe('Patient last name.'),
  patientName: z.string().describe('Patient full name.'),
  dateOfBirth: z.string().nullable().describe('Patient date of birth (yyyy-MM-dd).'),
  age: z.number().nullable().describe('Patient age in years (today). Null when DOB missing.'),
  sex: z.string().describe('Patient sex/gender label.'),
  city: z.string().describe('Patient city.'),
  state: z.string().describe('Patient state.'),
  zip: z.string().describe('Patient ZIP/postal code.'),
  phone: z.string().describe('Patient phone number.'),
  email: z.string().describe('Patient email address.'),
  source: z.string().describe('Point of discovery / marketing source.'),
  // --- Visit summary within range ---
  totalVisits: z.number().describe('Visits this patient had within the range.'),
  firstVisitDate: z.string().nullable().describe('Earliest visit date in range (yyyy-MM-dd).'),
  lastVisitDate: z.string().nullable().describe('Most recent visit date in range (yyyy-MM-dd).'),
  lastVisitStatus: z.string().describe('Status of the most recent visit in range.'),
  visitTypes: z.array(z.enum(['In-Person', 'Telemed'])).describe('Distinct visit types in range.'),
  locations: z.array(z.string()).describe('Distinct clinics visited in range.'),
  providers: z.array(z.string()).describe('Distinct attending providers seen in range.'),
  serviceCategories: z.array(z.string()).describe('Distinct service lines seen in range.'),
});

// Typed as keys of the row so a field that isn't in the schema is a compile error.
export const PATIENT_INTERNAL_FIELDS: readonly (keyof AdHocPatientRow)[] = [];

// Per-field opt-in value domain (see ENCOUNTER_DOMAIN_FIELDS for the policy): safe low-cardinality
// categoricals + problem-list ICD codes. Excludes identifiers/contact, provider names, numeric
// summaries (age, totalVisits, counts) and dates. visitTypes is a z.enum already.
export const PATIENT_DOMAIN_FIELDS: readonly (keyof AdHocPatientRow)[] = [
  'sex',
  'state',
  'lastVisitStatus',
  'locations',
  'serviceCategories',
  'source',
  'problemCodes',
];

// Opt-in layers, declared ONCE (metadata + Zod field schema); everything else derives from this map.
export const PATIENT_LAYERS = {
  allergies: {
    label: 'Allergies',
    description: "The patient's known allergy list.",
    schema: z.object({
      allergies: z.array(z.string()).describe('Known allergens (display names). Tally for top allergens.'),
      allergyCount: z.number().describe('Number of charted allergies. 0 when none.'),
    }),
  },
  problems: {
    label: 'Problem list',
    description: 'Chronic conditions / problem list (ICD-10), distinct from per-visit diagnoses.',
    schema: z.object({
      problems: z.array(z.string()).describe('Problem-list / chronic conditions (display names).'),
      problemCodes: z.array(z.string()).describe('ICD-10 codes for the problem list. HIERARCHICAL — prefix-match.'),
      problemCount: z.number().describe('Number of problem-list conditions.'),
    }),
  },
  medications: {
    label: 'Current medications',
    description: "The patient's current/home medication list.",
    schema: z.object({
      currentMedications: z.array(z.string()).describe('Current/home medications (display names).'),
      currentMedicationCount: z.number().describe('Number of current/home medications. 0 when none.'),
    }),
  },
  surgicalHistory: {
    label: 'Surgical history',
    description: "The patient's past surgical procedures.",
    schema: z.object({
      surgicalHistory: z.array(z.string()).describe('Past surgical procedures (names).'),
      surgicalHistoryCount: z.number().describe('Number of past surgeries charted.'),
    }),
  },
  hospitalizations: {
    label: 'Hospitalizations',
    description: "The patient's prior hospitalizations.",
    schema: z.object({
      hospitalizations: z.array(z.string()).describe('Prior hospitalization reasons.'),
      hospitalizationCount: z.number().describe('Number of prior hospitalizations charted.'),
    }),
  },
} as const satisfies AdHocLayerMap;

export type PatientLayerId = keyof typeof PATIENT_LAYERS;

export type AdHocPatientRow = z.infer<typeof PatientBaseRowSchema> & LayerRowFields<typeof PATIENT_LAYERS>;
export const AdHocPatientRowSchema = datasetRowSchema(PatientBaseRowSchema, PATIENT_LAYERS).describe(
  'One row per patient seen in range.'
) as unknown as z.ZodType<AdHocPatientRow>;

export const AdHocPatientsInputSchema = datasetInputSchema(PATIENT_LAYERS);
export type AdHocPatientsInput = DatasetInput<typeof PATIENT_LAYERS>;

export const AdHocPatientsOutputSchema = z.object({
  patients: z.array(AdHocPatientRowSchema),
});
export type AdHocPatientsOutput = { patients: AdHocPatientRow[] };
