import { getAdHocEncounters } from '../../../api/api';
import { availableLayersFor, dedupeByEncounter, fetchBatchedRange } from './datasetHelpers';
import { buildSchema, FieldDef } from './schema';
import { AdHocDataset, AdHocDatasetOption, AdHocRow, FetchContext } from './types';

// Comprehensive, one-row-per-encounter dataset that can power most visit/patient/clinical/KPI
// reports. Visit + patient + location/provider come back on every fetch; the three opt-in layers
// (checkboxes) add weight only when asked for.
export const ADHOC_ENCOUNTERS_OPTIONS: AdHocDatasetOption[] = [
  {
    id: 'codes',
    label: 'Clinical codes (ICD / CPT / E&M)',
    description: 'Diagnoses and procedure codes charted on the visit.',
    default: false,
  },
  {
    id: 'timing',
    label: 'KPI timing',
    description: 'Per-visit arrival → provider → discharge durations and on-time flag.',
    default: false,
  },
  {
    id: 'ai',
    label: 'AI assistance',
    description: 'Whether the visit used ambient scribe and/or the patient HPI chatbot.',
    default: false,
  },
  {
    id: 'medications',
    label: 'Medications',
    description: 'Drugs on the visit — eRx prescribed and in-house administered (all statuses).',
    default: false,
  },
  {
    id: 'vitals',
    label: 'Vital signs',
    description: 'Temperature, heart rate, blood pressure, SpO₂, respiration, weight, height, and BMI.',
    default: false,
  },
  {
    id: 'labs',
    label: 'Lab orders',
    description: 'Lab tests ordered on the visit (names + counts).',
    default: false,
  },
  {
    id: 'imaging',
    label: 'Imaging orders',
    description: 'Radiology / imaging studies ordered on the visit (names + counts).',
    default: false,
  },
  {
    id: 'immunizations',
    label: 'Immunizations',
    description: 'Vaccines given/recorded on the visit (names + counts).',
    default: false,
  },
  {
    id: 'disposition',
    label: 'Disposition / follow-up',
    description: 'Discharge disposition and charted follow-up plan.',
    default: false,
  },
  {
    id: 'examRos',
    label: 'Exam & ROS findings',
    description: 'Structured review-of-systems (reports/denies) and physical-exam findings.',
    default: false,
  },
  {
    id: 'results',
    label: 'Lab & imaging results',
    description: 'Resulted lab/imaging studies and abnormal-result counts.',
    default: false,
  },
  {
    id: 'nursing',
    label: 'Nursing orders',
    description: 'Nursing orders placed on the visit.',
    default: false,
  },
  {
    id: 'intake',
    label: 'Intake & screenings',
    description: 'ASQ screen, accident type, and birth history.',
    default: false,
  },
  {
    id: 'documents',
    label: 'Work / school notes',
    description: 'Work and school excuse notes issued on the visit.',
    default: false,
  },
];

// Always-present columns.
const BASE_FIELDS: FieldDef[] = [
  {
    name: 'date',
    type: 'date',
    description:
      "Visit date (yyyy-MM-dd). Rows are selected into the report by their PARENT appointment's date, " +
      "but follow-up rows carry their OWN (later) date — so a follow-up row's date can fall outside " +
      'the requested range.',
  },
  { name: 'visitType', type: 'string', description: '"In-Person" or "Telemed".' },
  {
    name: 'appointmentType',
    type: 'string',
    description: 'How the visit was booked: walk-in, pre-booked, or post-telemed.',
  },
  { name: 'serviceCategory', type: 'string', description: 'Service line of the visit (e.g. "Urgent Care").' },
  {
    name: 'visitStatus',
    type: 'string',
    description:
      'Visit status (completed, arrived, cancelled, no-show, …). Excludes nothing — filter cancelled/no-show out for "real" visits.',
  },
  {
    name: 'appointmentId',
    type: 'string',
    description:
      "Unique id of the visit. To link to the visit's progress note (review & sign page), render an " +
      'anchor with href="/in-person/" + appointmentId + "/review-and-sign" — links open in a new tab ' +
      'automatically. This is the right target for "the encounter", "the visit", "the note", or "the ' +
      'chart"; only use patientId (the /patient/ route) when the user asks for the patient profile.',
  },
  {
    name: 'encounterType',
    type: 'string',
    description:
      '"main" for a regular visit; "follow-up" / "scheduled-follow-up" for follow-up rows (separate ' +
      "rows with their own date, sharing the parent visit's appointmentId). Follow-up rows are " +
      "selected by the PARENT appointment's date but report their own, so their date can fall " +
      'outside the requested range. To link to a follow-up ' +
      'row\'s note, href="/in-person/" + appointmentId + "/follow-up-note" instead of the review-and-sign route.',
  },
  // Free text authored at booking — can embed patient names/PHI, so the value domain is withheld.
  { name: 'reason', type: 'string', description: 'Reason for visit (free text).', sensitive: true },
  { name: 'scheduledSlotMinutes', type: 'number', description: 'Booked appointment slot length in minutes.' },
  {
    name: 'patientId',
    type: 'string',
    description: 'Unique patient id. Link with href="/patient/" + patientId. Use to count UNIQUE patients.',
  },
  { name: 'firstName', type: 'string', description: 'Patient first name.' },
  { name: 'lastName', type: 'string', description: 'Patient last name.' },
  { name: 'patientName', type: 'string', description: 'Patient full name.' },
  { name: 'dateOfBirth', type: 'date', description: 'Patient date of birth (yyyy-MM-dd).' },
  { name: 'sex', type: 'string', description: 'Patient sex/gender label.' },
  { name: 'city', type: 'string', description: 'Patient city.' },
  { name: 'state', type: 'string', description: 'Patient state.' },
  { name: 'zip', type: 'string', description: 'Patient ZIP/postal code.' },
  { name: 'phone', type: 'string', description: 'Patient phone number.' },
  { name: 'email', type: 'string', description: 'Patient email address.' },
  {
    name: 'source',
    type: 'string',
    description: 'How the patient heard about the practice (point of discovery / marketing).',
  },
  { name: 'location', type: 'string', description: 'Clinic / location name.' },
  {
    name: 'region',
    type: 'string',
    description: "Clinic region — proxied by the location's state (use for regional / YTD-by-region rollups).",
  },
  {
    name: 'clinicOpenHours',
    type: 'number',
    description:
      "Hours the clinic is open on this visit's weekday (from the location's hours of operation). Use as the " +
      'denominator for patients-per-hour / throughput. Null when the location has no hours configured.',
  },
  { name: 'attendingProvider', type: 'string', description: 'Attending provider name.' },
  {
    name: 'registrationChannel',
    type: 'string',
    description: 'How the visit was registered: "Staff", "Self-scheduled", "Walk-in", or "Unknown".',
  },
  {
    name: 'registeredBy',
    type: 'string',
    // Staff login emails are workforce PII (a stronger identifier than a display name); withhold the
    // value domain from the model. registeredByName is already withheld via the name heuristic.
    sensitive: true,
    description: 'Staff login EMAIL that registered the visit, or "Patient" for patient-initiated registrations.',
  },
  {
    name: 'registeredByName',
    type: 'string',
    description:
      "Registrar's FULL NAME (resolved from the staff login email via the employee directory). Use this " +
      'to show "who registered" by name; falls back to the email/"Patient" when no name is on file.',
  },
];

const CODE_FIELDS: FieldDef[] = [
  {
    name: 'icdCodes',
    type: 'string[]',
    description:
      'ICD-10 diagnosis codes charted on the visit (primary first). ICD-10 is HIERARCHICAL — match a ' +
      'diagnosis FAMILY by category PREFIX (code.startsWith("H66")), not a hand-typed full-code list.',
  },
  {
    name: 'icdDisplays',
    type: 'string[]',
    description:
      'Human-readable diagnosis descriptions, parallel to icdCodes (same order). Use these for axis/bar/legend ' +
      'LABELS instead of (or alongside) the raw code, e.g. `${primaryIcd} ${primaryIcdDisplay}`.',
  },
  {
    name: 'primaryIcd',
    type: 'string',
    description:
      'The primary diagnosis code: the rank-1 diagnosis when one is explicitly marked primary, ' +
      'otherwise the FIRST charted diagnosis. Usually ICD-10, but falls back to another coding ' +
      '(e.g. SNOMED) when the diagnosis carries no ICD-10 coding.',
  },
  {
    name: 'primaryIcdDisplay',
    type: 'string',
    description:
      'Human-readable description of the primary diagnosis (e.g. "Streptococcal pharyngitis"). Use this for the ' +
      'label when a chart is grouped by primaryIcd — do NOT invent or append text like "primary dx".',
  },
  {
    name: 'cptCodes',
    type: 'string[]',
    description:
      'CPT/HCPCS procedure codes charted on the visit (excludes the E&M code). NOT hierarchical — ' +
      'do not prefix-match; filter against the actual codes present.',
  },
  {
    name: 'cptDisplays',
    type: 'string[]',
    description:
      'Human-readable CPT/HCPCS procedure descriptions, parallel to cptCodes (same order). Use these for ' +
      'LABELS instead of (or alongside) the raw code; do NOT invent or append text.',
  },
  { name: 'emCode', type: 'string', description: 'The visit\'s E&M code, e.g. "99213". Null when not set.' },
  {
    name: 'emDisplay',
    type: 'string',
    description:
      'Human-readable description of the E&M code (e.g. "Office visit, established, low complexity"). Use this ' +
      'for the label when a chart is grouped by emCode.',
  },
];

const TIMING_FIELDS: FieldDef[] = [
  {
    name: 'timeWithProviderMinutes',
    type: 'number',
    description: 'Minutes spent in the "provider" status (sum of closed periods).',
  },
  {
    name: 'arrivedToProviderMinutes',
    type: 'number',
    description: 'Minutes from arrival to first seen by the provider.',
  },
  { name: 'arrivedToIntakeMinutes', type: 'number', description: 'Minutes from arrival to intake.' },
  { name: 'intakeToProviderMinutes', type: 'number', description: 'Minutes from intake to provider.' },
  { name: 'providerToDischargedMinutes', type: 'number', description: 'Minutes from provider to discharge.' },
  { name: 'totalCycleMinutes', type: 'number', description: 'Total minutes from arrival to discharge (cycle time).' },
  {
    name: 'onTime',
    type: 'boolean',
    description: 'For pre-booked visits: did the patient arrive at/before the scheduled start? Null otherwise.',
  },
];

const AI_FIELDS: FieldDef[] = [
  {
    name: 'aiType',
    type: 'string',
    description: 'AI assistance used on the visit: "", "ambient scribe", "patient HPI chatbot", or both.',
  },
];

const MEDICATION_FIELDS: FieldDef[] = [
  {
    name: 'medicationIngredients',
    type: 'string[]',
    description:
      'All drugs on the visit — eRx prescribed AND in-house administered — normalized by removing the ' +
      'dose/strength tail (e.g. "Ibuprofen Oral Tablet 200 MG" -> "Ibuprofen Oral Tablet"). To COUNT ' +
      '"how many times each drug" tally ONLY this array across rows (it groups all strengths of one ' +
      'product). Do NOT also tally the medications array — that double-counts the same drug. Includes ' +
      'all statuses except entered-in-error.',
  },
  {
    name: 'medications',
    type: 'string[]',
    description:
      'All drugs on the visit (eRx + in-house) as full display names WITH strength/form ' +
      '(e.g. "Amoxicillin 500 mg tablet"). Use ONLY when the report needs the exact product; to count ' +
      'by drug use medicationIngredients instead (counting both arrays double-counts).',
  },
  {
    name: 'medicationSources',
    type: 'string[]',
    description:
      'Parallel to medications/medicationIngredients: "eRx" or "in-house" for each entry. Filter/split by this.',
  },
  {
    name: 'medicationCodes',
    type: 'string[]',
    description: 'Medispan dispensable-drug-id codes for eRx drugs (in-house entries have no Medispan code).',
  },
  {
    name: 'medicationCount',
    type: 'number',
    description: 'Total medications on the visit (eRx + in-house). 0 when none. Sum for total medication volume.',
  },
];

const VITALS_FIELDS: FieldDef[] = [
  {
    name: 'temperatureF',
    type: 'number',
    description: 'Body temperature in °F (most recent on the visit). Null if not taken.',
  },
  { name: 'heartRate', type: 'number', description: 'Heart rate in beats/min (most recent). Null if not taken.' },
  {
    name: 'respirationRate',
    type: 'number',
    description: 'Respiration rate in breaths/min (most recent). Null if not taken.',
  },
  {
    name: 'oxygenSaturation',
    type: 'number',
    description: 'Oxygen saturation (SpO₂) in % (most recent). Null if not taken.',
  },
  {
    name: 'systolicBP',
    type: 'number',
    description: 'Systolic blood pressure in mmHg (most recent). Null if not taken.',
  },
  {
    name: 'diastolicBP',
    type: 'number',
    description: 'Diastolic blood pressure in mmHg (most recent). Null if not taken.',
  },
  {
    name: 'weightKg',
    type: 'number',
    description: 'Weight in kilograms (most recent, unit-normalized). Null if not taken.',
  },
  {
    name: 'heightCm',
    type: 'number',
    description: 'Height in centimeters (most recent, unit-normalized). Null if not taken.',
  },
  {
    name: 'bmi',
    type: 'number',
    description: 'Body mass index, computed from weightKg/heightCm when both present. Null otherwise.',
  },
];

const LAB_FIELDS: FieldDef[] = [
  {
    name: 'labOrders',
    type: 'string[]',
    description:
      'Lab tests ordered on the visit (display names; excludes cancelled orders). Tally across rows for ' +
      'most-ordered labs. Order-level only — result values/abnormal flags are not included.',
  },
  { name: 'labOrderCount', type: 'number', description: 'Number of lab tests ordered on the visit. 0 when none.' },
];

const IMAGING_FIELDS: FieldDef[] = [
  {
    name: 'imagingOrders',
    type: 'string[]',
    description:
      'Imaging/radiology studies ordered on the visit (e.g. "X-ray of knee, 3 views"; excludes cancelled). ' +
      'Tally for imaging volume by study type. Order-level only — reports/reads are not included.',
  },
  {
    name: 'imagingOrderCount',
    type: 'number',
    description: 'Number of imaging studies ordered on the visit. 0 when none.',
  },
];

const IMMUNIZATION_FIELDS: FieldDef[] = [
  {
    name: 'immunizations',
    type: 'string[]',
    description:
      'Vaccines given/recorded on the visit (e.g. "Tdap (Tetanus, Diphtheria, Pertussis)"). Tally across ' +
      'rows for most-administered vaccines / immunization volume. Separate from medications.',
  },
  { name: 'immunizationCount', type: 'number', description: 'Number of vaccines on the visit. 0 when none.' },
];

const DISPOSITION_FIELDS: FieldDef[] = [
  {
    name: 'dischargeDisposition',
    type: 'string',
    description: 'Discharge disposition recorded on the encounter (e.g. home, transferred). "" when not recorded.',
    // In practice this surfaces the provider's free-text disposition NOTE (the FHIR coding carries
    // no display, so the `.text` note is what comes back) — staff prose, domain withheld.
    sensitive: true,
  },
  {
    name: 'followUpTypes',
    type: 'string[]',
    description:
      'Charted follow-up plan types on the visit (e.g. "Follow-up visit", PCP, ED). Tally for follow-up mix.',
  },
  { name: 'followUpCount', type: 'number', description: 'Number of follow-up plan items charted on the visit.' },
];

const EXAM_ROS_FIELDS: FieldDef[] = [
  {
    name: 'rosFindings',
    type: 'string[]',
    description:
      'Structured review-of-systems findings with state, e.g. "Reports Chills", "Denies Fever". Tally for ' +
      'most-charted symptoms; filter on "Reports "/"Denies " prefix for positives/negatives.',
  },
  {
    name: 'examSystems',
    type: 'string[]',
    description:
      'Charted physical-exam statements per system on the visit — both normal and abnormal summaries ' +
      '(e.g. "Regular rate and rhythm with no murmur", "Alert", "Ankle"). Use examFindings for the ' +
      'specific abnormal finding keys.',
  },
  {
    name: 'examFindings',
    type: 'string[]',
    description:
      'Specific physical-exam finding keys recorded (e.g. "ankle-right-tenderness-bony"). Tally for common findings.',
  },
];

const RESULTS_FIELDS: FieldDef[] = [
  {
    name: 'resultNames',
    type: 'string[]',
    description:
      'Names of resulted lab/imaging studies on the visit (DiagnosticReport). Tally for most-resulted tests. ' +
      'Encounter-linked results only — imaging reads linked solely through the order may be omitted.',
  },
  { name: 'resultCount', type: 'number', description: 'Number of resulted studies on the visit.' },
  {
    name: 'abnormalResultCount',
    type: 'number',
    description: 'Number of results flagged abnormal or inconclusive on the visit.',
  },
];

const NURSING_FIELDS: FieldDef[] = [
  // Nursing orders are authored as free-text instructions (no controlled catalog) — staff prose
  // that can embed patient details, so the value domain is withheld.
  {
    name: 'nursingOrders',
    type: 'string[]',
    description: 'Nursing orders placed on the visit (names).',
    sensitive: true,
  },
  { name: 'nursingOrderCount', type: 'number', description: 'Number of nursing orders on the visit. 0 when none.' },
];

const INTAKE_FIELDS: FieldDef[] = [
  {
    name: 'asqScreen',
    type: 'string',
    description: 'ASQ screen result: "Negative", "Positive", "Declined", "NotOffered", or "" when not charted.',
  },
  {
    name: 'accidentType',
    type: 'string',
    description: 'Accident type when the visit was accident-related (e.g. work, auto), else "".',
  },
  { name: 'birthHistory', type: 'string[]', description: 'Birth-history items charted (peds), when present.' },
];

const DOCUMENT_FIELDS: FieldDef[] = [
  {
    name: 'workSchoolNotes',
    type: 'string[]',
    description: 'Work/school excuse notes issued on the visit ("school" / "work" per note).',
  },
  { name: 'workSchoolNoteCount', type: 'number', description: 'Number of work/school notes issued on the visit.' },
];

function fieldsFor(options: Record<string, boolean>): FieldDef[] {
  return [
    ...BASE_FIELDS,
    ...(options.codes ? CODE_FIELDS : []),
    ...(options.timing ? TIMING_FIELDS : []),
    ...(options.ai ? AI_FIELDS : []),
    ...(options.medications ? MEDICATION_FIELDS : []),
    ...(options.vitals ? VITALS_FIELDS : []),
    ...(options.labs ? LAB_FIELDS : []),
    ...(options.imaging ? IMAGING_FIELDS : []),
    ...(options.immunizations ? IMMUNIZATION_FIELDS : []),
    ...(options.disposition ? DISPOSITION_FIELDS : []),
    ...(options.examRos ? EXAM_ROS_FIELDS : []),
    ...(options.results ? RESULTS_FIELDS : []),
    ...(options.nursing ? NURSING_FIELDS : []),
    ...(options.intake ? INTAKE_FIELDS : []),
    ...(options.documents ? DOCUMENT_FIELDS : []),
  ];
}

async function fetchAdHocEncounters({ oystehrZambda, dateRange, options }: FetchContext): Promise<AdHocRow[]> {
  const opts = options ?? {};
  const flags = {
    includeCodes: !!opts.codes,
    includeTiming: !!opts.timing,
    includeAi: !!opts.ai,
    includeMedications: !!opts.medications,
    includeVitals: !!opts.vitals,
    includeLabs: !!opts.labs,
    includeImaging: !!opts.imaging,
    includeImmunizations: !!opts.immunizations,
    includeDisposition: !!opts.disposition,
    includeExamRos: !!opts.examRos,
    includeResults: !!opts.results,
    includeNursing: !!opts.nursing,
    includeIntake: !!opts.intake,
    includeDocuments: !!opts.documents,
  };
  // Batch long ranges in parallel and dedupe by encounterId, like the other datasets.
  const rows = await fetchBatchedRange(
    dateRange,
    (range) => getAdHocEncounters(oystehrZambda, { dateRange: range, ...flags }).then((r) => r.encounters),
    dedupeByEncounter
  );
  return rows as unknown as AdHocRow[];
}

export const adhocEncountersDataset: AdHocDataset = {
  id: 'encounters-comprehensive',
  label: 'Encounters',
  description:
    'One row per encounter with visit, patient, contact, and location/provider detail; optional ' +
    'clinical codes, KPI timing, and AI-assistance layers.',
  options: ADHOC_ENCOUNTERS_OPTIONS,
  fetch: fetchAdHocEncounters,
  buildSchema: (rows, options) => {
    const opts = options ?? {};
    // Layers that exist but aren't loaded → the generator names the `id`s it needs in `needsLayers`
    // and the client auto-fetches them, instead of approximating a concept this fetch doesn't carry.
    return buildSchema(
      rows,
      {
        datasetId: 'encounters-comprehensive',
        label: 'Encounters',
        description: 'One row per encounter — visit, patient, contact, location/provider, and any enabled layers.',
        availableLayers: availableLayersFor(ADHOC_ENCOUNTERS_OPTIONS, opts),
      },
      fieldsFor(opts)
    );
  },
};
