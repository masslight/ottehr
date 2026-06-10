import { DateTime } from 'luxon';
import { DEFAULT_BATCH_DAYS, IncompleteEncounterItem, splitDateRangeIntoBatches } from 'utils';
import { getEncountersReport } from '../../../api/api';
import { buildSchema, FieldDef } from './schema';
import { AdHocDataset, AdHocRow, FetchContext } from './types';

const TZ = 'America/New_York';

// Reporting-relevant fields exposed to the report code + described to the LLM. Base fields come
// from the encounters report; the rest are cheap client-side derivations (age, length-of-stay,
// time buckets) that unlock most "by time / by demographic" questions for free.
const FIELDS: FieldDef[] = [
  { name: 'date', type: 'date', description: 'Visit date (yyyy-MM-dd), from the appointment start.' },
  { name: 'month', type: 'string', description: 'Visit month (yyyy-MM).' },
  { name: 'dayOfWeek', type: 'string', description: 'Day of week of the visit (Monday … Sunday).' },
  { name: 'hourOfDay', type: 'number', description: 'Hour the visit started, 0–23 (America/New_York).' },
  { name: 'visitType', type: 'string', description: 'Telemed or In-Person.' },
  {
    name: 'visitStatus',
    type: 'string',
    description: 'Visit status (e.g. completed, cancelled, no-show, arrived, intake).',
  },
  { name: 'location', type: 'string', description: 'Clinic / location name.' },
  { name: 'attendingProvider', type: 'string', description: 'Attending provider name.' },
  { name: 'reason', type: 'string', description: 'Reason for visit (free text; often high-cardinality).' },
  { name: 'ageYears', type: 'number', description: 'Patient age in years.' },
  {
    name: 'scheduledSlotMinutes',
    type: 'number',
    description:
      'Booked appointment slot length in minutes (scheduled end − start). This is the SCHEDULED duration, ' +
      'NOT time spent — most slots are a standard length (e.g. 15), so it is nearly constant.',
  },
  {
    name: 'timeWithProviderMinutes',
    type: 'number',
    description:
      'Actual minutes the patient spent with the provider (tracked "provider" visit status), excluding ' +
      'waiting room and intake. Null when the visit was not tracked through the provider stage.',
  },
  { name: 'patientName', type: 'string', description: 'Patient full name (free text).' },
  { name: 'dateOfBirth', type: 'date', description: 'Patient date of birth (yyyy-MM-dd).' },
  {
    name: 'icdCodes',
    type: 'string[]',
    description:
      'ICD-10 diagnosis codes charted on the visit (assessment), e.g. ["J06.9","H66.91"]. The primary ' +
      'diagnosis is FIRST when one was marked. Empty array when no diagnoses were charted.',
  },
  {
    name: 'cptCodes',
    type: 'string[]',
    description:
      'CPT procedure/billing codes charted on the visit, e.g. ["96372","J1885"]. Excludes the E&M code ' +
      '(see emCode). Empty array when none were charted.',
  },
  {
    name: 'emCode',
    type: 'string',
    description: 'The visit\'s E&M (evaluation & management) code, e.g. "99213". Null when not set.',
  },
];

function toRow(e: IncompleteEncounterItem): AdHocRow {
  const start = e.appointmentStart ? DateTime.fromISO(e.appointmentStart).setZone(TZ) : undefined;
  const end = e.appointmentEnd ? DateTime.fromISO(e.appointmentEnd).setZone(TZ) : undefined;
  const dob = e.dateOfBirth ? DateTime.fromISO(e.dateOfBirth) : undefined;

  return {
    date: start?.isValid ? start.toFormat('yyyy-MM-dd') : null,
    month: start?.isValid ? start.toFormat('yyyy-MM') : null,
    dayOfWeek: start?.isValid ? start.toFormat('cccc') : null,
    hourOfDay: start?.isValid ? start.hour : null,
    visitType: e.visitType ?? 'Unknown',
    visitStatus: e.visitStatus ?? 'unknown',
    location: e.location ?? 'Unknown',
    attendingProvider: e.attendingProvider ?? 'Unknown',
    reason: e.reason ?? '',
    ageYears: dob?.isValid ? Math.floor(DateTime.now().diff(dob, 'years').years) : null,
    scheduledSlotMinutes: start?.isValid && end?.isValid ? Math.round(end.diff(start, 'minutes').minutes) : null,
    timeWithProviderMinutes: e.timeWithProviderMinutes ?? null,
    patientName: e.patientName ?? '',
    dateOfBirth: e.dateOfBirth ?? null,
    icdCodes: e.icdCodes ?? [],
    cptCodes: e.cptCodes ?? [],
    emCode: e.emCode ?? null,
  };
}

async function fetchEncounters({ oystehrZambda, dateRange }: FetchContext): Promise<AdHocRow[]> {
  const { start, end } = dateRange;
  const days = DateTime.fromISO(end).diff(DateTime.fromISO(start), 'days').days;

  let items: IncompleteEncounterItem[];
  if (days <= DEFAULT_BATCH_DAYS) {
    const resp = await getEncountersReport(oystehrZambda, {
      dateRange: { start, end },
      encounterStatus: 'all',
      includeCodes: true,
    });
    items = resp.encounters;
  } else {
    // Wide ranges: fetch in batches in parallel (same pattern as the Complete Encounters report).
    const batches = splitDateRangeIntoBatches(start, end, DEFAULT_BATCH_DAYS);
    const results = await Promise.all(
      batches.map((batch) =>
        getEncountersReport(oystehrZambda, { dateRange: batch, encounterStatus: 'all', includeCodes: true })
      )
    );
    const merged = results.flatMap((r) => r.encounters);
    // Dedupe by appointmentId in case of batch-boundary overlap.
    items = Array.from(new Map(merged.map((e) => [e.appointmentId, e])).values());
  }

  return items.map(toRow);
}

export const encountersDataset: AdHocDataset = {
  id: 'encounters',
  label: 'Encounters',
  description:
    'One row per visit (appointment + encounter) in the selected date range: status, location, ' +
    'provider, visit type, reason, patient age/name, time with provider, and time buckets.',
  fetch: fetchEncounters,
  buildSchema: (rows) =>
    buildSchema(
      rows,
      { datasetId: 'encounters', label: 'Encounters', description: 'One row per visit in the date range.' },
      FIELDS
    ),
};
