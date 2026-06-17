import { DateTime } from 'luxon';
import { DEFAULT_BATCH_DAYS, RecentPatientRecord, splitDateRangeIntoBatches } from 'utils';
import { getRecentPatientsReport } from '../../../api/api';
import { buildSchema, FieldDef } from './schema';
import { AdHocDataset, AdHocRow, FetchContext } from './types';

// Patient-level dataset: one row per patient with their most recent visit. Powers the "Customize"
// hand-off from the Recent Patients report, and is selectable on its own from the ad-hoc dataset
// picker. Columns mirror the Recent Patients report.
const FIELDS: FieldDef[] = [
  {
    name: 'patientId',
    type: 'string',
    description: 'Unique patient id. Link to the profile with href="/patient/" + patientId.',
  },
  { name: 'firstName', type: 'string', description: 'Patient first name.' },
  { name: 'lastName', type: 'string', description: 'Patient last name.' },
  { name: 'phoneNumber', type: 'string', description: 'Patient phone number.' },
  { name: 'email', type: 'string', description: 'Patient email address.' },
  { name: 'visitMode', type: 'string', description: 'Whether the most recent visit was In-person or Telemed.' },
  { name: 'location', type: 'string', description: 'Clinic / location name of the most recent visit.' },
  { name: 'provider', type: 'string', description: 'Attending provider on the most recent visit.' },
  {
    name: 'patientStatus',
    type: 'string',
    description: 'Whether the patient is "new" or "existing" (existing = had a visit before this date range).',
  },
  {
    name: 'source',
    type: 'string',
    description: 'How the patient heard about the practice (point of discovery / marketing source).',
  },
  { name: 'mostRecentVisitDate', type: 'date', description: "Date of the patient's most recent visit (yyyy-MM-dd)." },
];

function toRow(p: RecentPatientRecord): AdHocRow {
  let visitMode = p.mostRecentVisit?.serviceCategory || '';
  if (visitMode === 'in-person-service-mode') visitMode = 'In-person';
  else if (visitMode === 'virtual-service-mode') visitMode = 'Telemed';
  return {
    patientId: p.patientId,
    firstName: p.firstName,
    lastName: p.lastName,
    phoneNumber: p.phoneNumber,
    email: p.email,
    visitMode,
    location: p.mostRecentVisit?.location ?? '',
    provider: p.mostRecentVisit?.attendingProvider ?? '',
    patientStatus: p.patientStatus,
    source: p.pointOfDiscovery ?? '',
    mostRecentVisitDate: p.mostRecentVisit?.date ? p.mostRecentVisit.date.slice(0, 10) : null,
  };
}

// Mirrors the Recent Patients page's batching: ranges over DEFAULT_BATCH_DAYS are split, fetched in
// parallel, then de-duped by patientId (a patient can appear in multiple batches).
async function fetchRecentPatients({ oystehrZambda, dateRange }: FetchContext): Promise<AdHocRow[]> {
  const { start, end } = dateRange;
  const days = DateTime.fromISO(end).diff(DateTime.fromISO(start), 'days').days;
  let patients: RecentPatientRecord[];
  if (days <= DEFAULT_BATCH_DAYS) {
    patients = (await getRecentPatientsReport(oystehrZambda, { dateRange: { start, end } })).patients;
  } else {
    const batches = splitDateRangeIntoBatches(start, end, DEFAULT_BATCH_DAYS);
    const results = await Promise.all(batches.map((b) => getRecentPatientsReport(oystehrZambda, { dateRange: b })));
    const all = results.flatMap((r) => r.patients);
    patients = Array.from(new Map(all.map((p) => [p.patientId, p])).values());
  }
  return patients.map(toRow);
}

export const recentPatientsDataset: AdHocDataset = {
  id: 'recent-patients',
  label: 'Recent Patients',
  description: 'One row per patient with their most recent visit — name, contact, source, visit mode, and status.',
  fetch: fetchRecentPatients,
  buildSchema: (rows) =>
    buildSchema(
      rows,
      {
        datasetId: 'recent-patients',
        label: 'Recent Patients',
        description: 'One row per patient with their most recent visit, from the Recent Patients report.',
      },
      FIELDS
    ),
};
