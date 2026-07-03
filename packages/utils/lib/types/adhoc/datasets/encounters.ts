// Encounters dataset (one row per encounter). The Zod schemas below are the single source of truth:
// they derive the TS types, validate the response, and are serialized for the generation prompt
// (names/types/descriptions; enum members for closed vocabularies — never values sampled from data).
// Field descriptions are written for the LLM.
import { z } from 'zod';
import { AdHocLayerMap, DatasetInput, datasetInputSchema, datasetRowSchema, LayerRowFields } from './dataset';

// Base columns — always present on every row.
export const EncounterBaseRowSchema = z.object({
  // --- Visit ---
  appointmentId: z.string().describe('Visit id; link href="/in-person/"+appointmentId+"/review-and-sign".'),
  encounterId: z.string().optional().describe('Encounter id (internal — dedupe/joins).'),
  date: z.string().nullable().describe('Viewer-local visit day (yyyy-MM-dd); day-level companion of startTime.'),
  startTime: z
    .string()
    .describe(
      "Full ISO visit start ('' when unknown). Format in the user's LOCAL timezone via new Date(startTime).toLocaleTimeString(...); do NOT slice the ISO string (shows UTC)."
    ),
  trackingBoardHref: z
    .string()
    .optional()
    .describe(
      "Ready-made tracking-board link for the visit ('' when none). Render startTime as an anchor with href=trackingBoardHref only when non-empty."
    ),
  visitType: z.enum(['In-Person', 'Telemed', 'Unknown']).describe('Visit modality.'),
  appointmentType: z.string().describe('Walk-in, pre-booked, or post-telemed.'),
  serviceCategory: z.string().describe('Service line (e.g. "Urgent Care").'),
  visitStatus: z.string().describe('completed / arrived / cancelled / no-show …'),
  encounterType: z.enum(['main', 'follow-up', 'scheduled-follow-up']).describe('Kind of encounter row.'),
  reason: z.string().describe('Reason for visit (free text).'),
  scheduledSlotMinutes: z.number().nullable().describe('Booked slot length in minutes.'),
  // --- Patient ---
  patientId: z.string().describe('Patient id; link href="/patient/"+patientId. Count UNIQUE patients.'),
  firstName: z.string().describe('Patient first name.'),
  lastName: z.string().describe('Patient last name.'),
  patientName: z.string().describe('Patient full name.'),
  dateOfBirth: z.string().nullable().describe('Patient date of birth (yyyy-MM-dd).'),
  sex: z.string().describe('Patient sex/gender label.'),
  city: z.string().describe('Patient city.'),
  state: z.string().describe('Patient state.'),
  zip: z.string().describe('Patient ZIP/postal code.'),
  phone: z.string().describe('Patient phone number.'),
  email: z.string().describe('Patient email address.'),
  source: z.string().describe('Point of discovery / marketing source.'),
  // --- Location / Provider ---
  location: z.string().describe('Clinic / location name.'),
  locationId: z.string().optional().describe('Location id (internal — joins).'),
  region: z.string().describe("Clinic region (location's state)."),
  clinicOpenHours: z.number().nullable().describe("Open hours on this visit's weekday. Null if unset."),
  attendingProvider: z.string().describe('Attending provider name.'),
  attendingProviderId: z.string().optional().describe('Attending provider id (internal — joins).'),
  // --- Registration ---
  registrationChannel: z
    .enum(['Staff', 'Self-scheduled', 'Walk-in', 'Unknown'])
    .describe('How the visit was registered.'),
  registeredBy: z.string().describe('Staff login email, or "Patient".'),
  registeredByName: z.string().describe("Registrar's full name (falls back to email/Patient)."),
});

// Row-only ids: needed for dedupe/joins, never described to the model. Typed as keys of the row so a
// field absent from the schema is a compile error.
export const ENCOUNTER_INTERNAL_FIELDS: readonly (keyof AdHocEncounterRow)[] = [
  'encounterId',
  'locationId',
  'attendingProviderId',
];

// Per-field opt-in value domain: for these fields ONLY, the distinct values present in the fetched
// rows are sampled and shown to the LLM (capped; see sampleDomains) — the one path by which real
// values reach the model. Limited to two safe kinds so the model filters/groups against values that
// truly occur instead of guessing:
//   - low-cardinality, data-dependent categoricals (service line, status, location, …) not closed
//     enough to be a z.enum;
//   - clinical code / code-label fields and order/result/vaccine/drug name arrays — the names a
//     report has to filter or group by, which are unguessable unless the real ones are disclosed.
// Excluded (schema-only): identifiers & contact, free text, provider names, exam/ROS findings, drug
// displays WITH strength (high-cardinality; medicationIngredients is the field to count by), all
// numeric/date fields (a value list is meaningless). Closed vocabularies are z.enum and
// need no entry. Typed as keys of the row so a field absent from the schema is a compile error.
export const ENCOUNTER_DOMAIN_FIELDS: readonly (keyof AdHocEncounterRow)[] = [
  // base categoricals
  'appointmentType',
  'serviceCategory',
  'visitStatus',
  'sex',
  'state',
  'region',
  'location',
  'source',
  // codes / labels (codes layer)
  'icdCodes',
  'icdDisplays',
  'primaryIcd',
  'primaryIcdDisplay',
  'cptCodes',
  'cptDisplays',
  'emCode',
  'emDisplay',
  // clinical categoricals / name arrays (various layers)
  'aiType',
  'labOrders',
  'imagingOrders',
  'immunizations',
  'nursingOrders',
  'resultNames',
  'medicationIngredients',
  'followUpTypes',
  'asqScreen',
  'accidentType',
  'workSchoolNotes',
];

// Opt-in layers, declared once (metadata + Zod field schema). Row/response schema, endpoint input
// flags, UI checkboxes, and the prompt's availableLayers all derive from this map — a layer's id
// lives here and nowhere else.
export const ENCOUNTER_LAYERS = {
  codes: {
    label: 'Clinical codes (ICD / CPT / E&M)',
    description: 'Diagnoses and procedure codes charted on the visit.',
    schema: z.object({
      icdCodes: z.array(z.string()).describe('ICD-10 dx codes (primary first). HIERARCHICAL — prefix-match.'),
      icdDisplays: z.array(z.string()).describe('Dx descriptions, parallel to icdCodes.'),
      primaryIcd: z.string().describe('Primary (rank-1) ICD-10 code, if marked.'),
      primaryIcdDisplay: z.string().describe('Primary dx description.'),
      cptCodes: z.array(z.string()).describe('CPT/HCPCS codes (excl. E&M). NOT hierarchical.'),
      cptDisplays: z.array(z.string()).describe('CPT/HCPCS descriptions, parallel to cptCodes.'),
      emCode: z.string().describe('E&M code, e.g. "99213". "" when unset.'),
      emDisplay: z.string().describe('E&M code description.'),
    }),
  },
  timing: {
    label: 'KPI timing',
    description: 'Per-visit arrival → provider → discharge durations and on-time flag.',
    schema: z.object({
      timeWithProviderMinutes: z.number().nullable().describe('Minutes in "provider" status.'),
      arrivedToProviderMinutes: z.number().nullable().describe('Arrival → first seen by provider.'),
      arrivedToIntakeMinutes: z.number().nullable().describe('Arrival → intake.'),
      intakeToProviderMinutes: z.number().nullable().describe('Intake → provider.'),
      providerToDischargedMinutes: z.number().nullable().describe('Provider → discharge.'),
      totalCycleMinutes: z.number().nullable().describe('Arrival → discharge (cycle time).'),
      onTime: z.boolean().nullable().describe('Pre-booked: arrived at/before scheduled start? Null otherwise.'),
    }),
  },
  ai: {
    label: 'AI assistance',
    description: 'Whether the visit used ambient scribe and/or the patient HPI chatbot.',
    schema: z.object({
      aiType: z.string().describe('AI on visit: "", "ambient scribe", "patient HPI chatbot", or both.'),
    }),
  },
  medications: {
    label: 'Medications',
    description: 'Drugs on the visit — eRx prescribed and in-house administered (all statuses).',
    schema: z.object({
      medications: z.array(z.string()).describe('All drugs (eRx + in-house), full display w/ strength.'),
      medicationIngredients: z
        .array(z.string())
        .describe('Drug display without strength/dose — group and count by THIS.'),
      medicationSources: z.array(z.enum(['eRx', 'in-house'])).describe('Parallel: source per entry.'),
      medicationCodes: z.array(z.string()).describe('Medispan dispensable-drug-id codes (eRx).'),
      medicationCount: z.number().describe('Total medications on the visit. 0 when none.'),
    }),
  },
  vitals: {
    label: 'Vital signs',
    description: 'Temperature, heart rate, blood pressure, SpO₂, respiration, weight, height, and BMI.',
    schema: z.object({
      temperatureF: z.number().nullable().describe('Temperature °F (most recent). Null if not taken.'),
      heartRate: z.number().nullable().describe('Heart rate bpm (most recent). Null if not taken.'),
      respirationRate: z.number().nullable().describe('Respiration /min (most recent). Null if not taken.'),
      oxygenSaturation: z.number().nullable().describe('SpO₂ % (most recent). Null if not taken.'),
      systolicBP: z.number().nullable().describe('Systolic BP mmHg (most recent). Null if not taken.'),
      diastolicBP: z.number().nullable().describe('Diastolic BP mmHg (most recent). Null if not taken.'),
      weightKg: z.number().nullable().describe('Weight kg (most recent, normalized). Null if not taken.'),
      heightCm: z.number().nullable().describe('Height cm (most recent, normalized). Null if not taken.'),
      bmi: z.number().nullable().describe('BMI from weightKg/heightCm when both present. Null otherwise.'),
    }),
  },
  labs: {
    label: 'Lab orders',
    description: 'Lab tests ordered on the visit (names + counts).',
    schema: z.object({
      labOrders: z.array(z.string()).describe('Lab tests ordered (names; excl. cancelled).'),
      labOrderCount: z.number().describe('Number of lab tests ordered. 0 when none.'),
    }),
  },
  imaging: {
    label: 'Imaging orders',
    description: 'Radiology / imaging studies ordered on the visit (names + counts).',
    schema: z.object({
      imagingOrders: z.array(z.string()).describe('Imaging/radiology studies ordered (excl. cancelled).'),
      imagingOrderCount: z.number().describe('Number of imaging studies ordered. 0 when none.'),
    }),
  },
  immunizations: {
    label: 'Immunizations',
    description: 'Vaccines given/recorded on the visit (names + counts).',
    schema: z.object({
      immunizations: z.array(z.string()).describe('Vaccines given/recorded on the visit.'),
      immunizationCount: z.number().describe('Number of vaccines on the visit. 0 when none.'),
    }),
  },
  disposition: {
    label: 'Disposition / follow-up',
    description: 'Discharge disposition and charted follow-up plan.',
    schema: z.object({
      followUpTypes: z.array(z.string()).describe('Charted follow-up plan types.'),
      followUpCount: z.number().describe('Number of follow-up plan items charted.'),
      dischargeDisposition: z
        .string()
        .describe('Discharge disposition on the encounter — FREE TEXT (may be full instructions). "" when unset.'),
    }),
  },
  examRos: {
    label: 'Exam & ROS findings',
    description: 'Structured review-of-systems (reports/denies) and physical-exam findings.',
    schema: z.object({
      rosFindings: z.array(z.string()).describe('ROS findings with state, e.g. "Reports Chills".'),
      examSystems: z.array(z.string()).describe('Physical-exam statements per system.'),
      examFindings: z.array(z.string()).describe('Specific physical-exam finding keys.'),
    }),
  },
  results: {
    label: 'Lab & imaging results',
    description: 'Resulted lab/imaging studies and abnormal-result counts.',
    schema: z.object({
      resultNames: z.array(z.string()).describe('Names of resulted lab/imaging studies.'),
      resultCount: z.number().describe('Number of resulted studies on the visit.'),
      abnormalResultCount: z.number().describe('Results flagged abnormal/inconclusive.'),
    }),
  },
  nursing: {
    label: 'Nursing orders',
    description: 'Nursing orders placed on the visit.',
    schema: z.object({
      nursingOrders: z.array(z.string()).describe('Nursing orders placed on the visit (names).'),
      nursingOrderCount: z.number().describe('Number of nursing orders. 0 when none.'),
    }),
  },
  intake: {
    label: 'Intake & screenings',
    description: 'ASQ screen, accident type, and birth history.',
    schema: z.object({
      asqScreen: z.string().describe('ASQ screen: Negative/Positive/Declined/NotOffered/"".'),
      accidentType: z.string().describe('Accident type when accident-related, else "".'),
      birthHistory: z.array(z.string()).describe('Birth-history items (peds), when present.'),
    }),
  },
  documents: {
    label: 'Work / school notes',
    description: 'Work and school excuse notes issued on the visit.',
    schema: z.object({
      workSchoolNotes: z.array(z.string()).describe('Work/school excuse notes issued ("school"/"work").'),
      workSchoolNoteCount: z.number().describe('Number of work/school notes issued.'),
    }),
  },
} as const satisfies AdHocLayerMap;

export type EncounterLayerId = keyof typeof ENCOUNTER_LAYERS;

// Full row: base columns required, every layer column optional (present when its layer was
// requested); the schema the response is validated against. `datasetRowSchema` merges generically
// (loose static shape), so we tag it with the precise row type from the same layer map — validation
// stays runtime-exact and consumers get the precise type.
export type AdHocEncounterRow = z.infer<typeof EncounterBaseRowSchema> & LayerRowFields<typeof ENCOUNTER_LAYERS>;
export const AdHocEncounterRowSchema = datasetRowSchema(EncounterBaseRowSchema, ENCOUNTER_LAYERS).describe(
  'One row per encounter.'
) as unknown as z.ZodType<AdHocEncounterRow>;

// Endpoint input: the date window + one include<Layer> flag per layer, derived from the map.
export const AdHocEncountersInputSchema = datasetInputSchema(ENCOUNTER_LAYERS);
export type AdHocEncountersInput = DatasetInput<typeof ENCOUNTER_LAYERS>;

export const AdHocEncountersOutputSchema = z.object({
  encounters: z.array(AdHocEncounterRowSchema),
});
export type AdHocEncountersOutput = { encounters: AdHocEncounterRow[] };
