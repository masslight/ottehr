import { DEFAULT_BATCH_DAYS, splitDateRangeIntoBatches } from 'utils';
import { getAdHocEncounters } from '../../../api/api';
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
];

// Always-present columns.
const BASE_FIELDS: FieldDef[] = [
  { name: 'date', type: 'date', description: 'Visit date (yyyy-MM-dd).' },
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
    name: 'encounterType',
    type: 'string',
    description: '"main" for a regular visit; "follow-up" / "scheduled-follow-up" for follow-up rows.',
  },
  { name: 'reason', type: 'string', description: 'Reason for visit (free text).' },
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
    description: 'Staff email that registered the visit, or "Patient" for patient-initiated registrations.',
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
  { name: 'primaryIcd', type: 'string', description: 'The primary (rank-1) ICD-10 diagnosis code, if one was marked.' },
  {
    name: 'cptCodes',
    type: 'string[]',
    description:
      'CPT/HCPCS procedure codes charted on the visit (excludes the E&M code). NOT hierarchical — ' +
      'do not prefix-match; filter against the actual codes present.',
  },
  { name: 'emCode', type: 'string', description: 'The visit\'s E&M code, e.g. "99213". Null when not set.' },
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
  },
  {
    name: 'followUpTypes',
    type: 'string[]',
    description:
      'Charted follow-up plan types on the visit (e.g. "Follow-up visit", PCP, ED). Tally for follow-up mix.',
  },
  { name: 'followUpCount', type: 'number', description: 'Number of follow-up plan items charted on the visit.' },
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
  };
  const { start, end } = dateRange;
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  // Batch long ranges in parallel and dedupe by encounterId, like the other datasets.
  if (days <= DEFAULT_BATCH_DAYS) {
    const { encounters } = await getAdHocEncounters(oystehrZambda, { dateRange: { start, end }, ...flags });
    return encounters as unknown as AdHocRow[];
  }
  const batches = splitDateRangeIntoBatches(start, end, DEFAULT_BATCH_DAYS);
  const results = await Promise.all(batches.map((b) => getAdHocEncounters(oystehrZambda, { dateRange: b, ...flags })));
  const all = results.flatMap((r) => r.encounters);
  return Array.from(new Map(all.map((e) => [e.encounterId ?? e.appointmentId, e])).values()) as unknown as AdHocRow[];
}

export const adhocEncountersDataset: AdHocDataset = {
  id: 'encounters-comprehensive',
  label: 'Encounters (comprehensive)',
  description:
    'One row per encounter with visit, patient, contact, and location/provider detail; optional ' +
    'clinical codes, KPI timing, and AI-assistance layers.',
  options: ADHOC_ENCOUNTERS_OPTIONS,
  fetch: fetchAdHocEncounters,
  buildSchema: (rows, options) => {
    const opts = options ?? {};
    // Layers that exist but aren't loaded → the report can name the exact checkbox to enable
    // instead of approximating a concept this fetch doesn't carry.
    const availableLayers = ADHOC_ENCOUNTERS_OPTIONS.filter((o) => !opts[o.id]).map((o) => ({
      label: o.label,
      description: o.description ?? '',
    }));
    return buildSchema(
      rows,
      {
        datasetId: 'encounters-comprehensive',
        label: 'Encounters (comprehensive)',
        description: 'One row per encounter — visit, patient, contact, location/provider, and any enabled layers.',
        availableLayers,
      },
      fieldsFor(opts)
    );
  },
};
