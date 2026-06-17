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
  { name: 'attendingProvider', type: 'string', description: 'Attending provider name.' },
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

function fieldsFor(options: Record<string, boolean>): FieldDef[] {
  return [
    ...BASE_FIELDS,
    ...(options.codes ? CODE_FIELDS : []),
    ...(options.timing ? TIMING_FIELDS : []),
    ...(options.ai ? AI_FIELDS : []),
  ];
}

async function fetchAdHocEncounters({ oystehrZambda, dateRange, options }: FetchContext): Promise<AdHocRow[]> {
  const opts = options ?? {};
  const flags = { includeCodes: !!opts.codes, includeTiming: !!opts.timing, includeAi: !!opts.ai };
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
  buildSchema: (rows, options) =>
    buildSchema(
      rows,
      {
        datasetId: 'encounters-comprehensive',
        label: 'Encounters (comprehensive)',
        description: 'One row per encounter — visit, patient, contact, location/provider, and any enabled layers.',
      },
      fieldsFor(options ?? {})
    ),
};
