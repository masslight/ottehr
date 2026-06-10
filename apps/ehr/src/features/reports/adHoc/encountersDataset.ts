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
  { name: 'lengthOfStayMinutes', type: 'number', description: 'Appointment length in minutes (end − start).' },
  { name: 'patientName', type: 'string', description: 'Patient full name (free text).' },
  { name: 'dateOfBirth', type: 'date', description: 'Patient date of birth (yyyy-MM-dd).' },
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
    lengthOfStayMinutes: start?.isValid && end?.isValid ? Math.round(end.diff(start, 'minutes').minutes) : null,
    patientName: e.patientName ?? '',
    dateOfBirth: e.dateOfBirth ?? null,
  };
}

async function fetchEncounters({ oystehrZambda, dateRange }: FetchContext): Promise<AdHocRow[]> {
  const { start, end } = dateRange;
  const days = DateTime.fromISO(end).diff(DateTime.fromISO(start), 'days').days;

  let items: IncompleteEncounterItem[];
  if (days <= DEFAULT_BATCH_DAYS) {
    const resp = await getEncountersReport(oystehrZambda, { dateRange: { start, end }, encounterStatus: 'all' });
    items = resp.encounters;
  } else {
    // Wide ranges: fetch in batches in parallel (same pattern as the Complete Encounters report).
    const batches = splitDateRangeIntoBatches(start, end, DEFAULT_BATCH_DAYS);
    const results = await Promise.all(
      batches.map((batch) => getEncountersReport(oystehrZambda, { dateRange: batch, encounterStatus: 'all' }))
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
    'provider, visit type, reason, patient age/name, length of stay, and time buckets.',
  fetch: fetchEncounters,
  buildSchema: (rows) =>
    buildSchema(
      rows,
      { datasetId: 'encounters', label: 'Encounters', description: 'One row per visit in the date range.' },
      FIELDS
    ),
};
