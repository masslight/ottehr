// M0 check for ad-hoc reports: runs the report fetch helpers against a real project and checks that nothing is
// cut off, by comparing what an async job returned with an exact count of the same search. READ-ONLY: searches
// only. Prints counts and times, never resource content.
//
//   npm run adhoc-m0-spike -- <env> [days=60]      (env = a file in config/.env, e.g. local)
//
// What it shows:
//   1. root: time, and per date window the appointments returned against an exact count of that window;
//   2. a by-id search (every Observation of 250 visits) against an exact count;
//   3. the time of a whole layer search (vital readings of every visit of the range).
// Any "MISSING" line means the reports would lose data: do not ship.
import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource, Observation } from 'fhir/r4b';
import { writeFileSync } from 'fs';
import { DateTime } from 'luxon';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  fetchAppointmentReportResources,
  fetchScopedResources,
  IDS_PER_ENTRY,
  reportWindows,
} from '../shared/adhoc-report';
import { getAuth0Token } from '../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../shared/helpers';
import { performEffectWithEnvFile } from './helpers';

type Param = { name: string; value: string };

const ROOT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist,cancelled,noshow';

/** Exact number of matches. `_summary=count` reports 1 for an empty result, so a 1 is confirmed with one entry. */
async function exactCount(
  oystehr: Oystehr,
  resourceType: FhirResource['resourceType'],
  params: Param[]
): Promise<number> {
  const bundle = await oystehr.fhir.search({
    resourceType,
    params: [
      ...params,
      { name: '_elements', value: 'id' },
      { name: '_count', value: '1' },
      { name: '_total', value: 'accurate' },
    ],
  });
  const found = bundle.unbundle().length;
  return found > 0 ? Math.max(bundle.total ?? found, found) : 0;
}

async function main(config: Record<string, string>): Promise<void> {
  const days = Number(process.argv[3] ?? 60);
  const token = await getAuth0Token(config as never);
  if (!token) throw new Error('no token');
  const oystehr = createClinicalOystehrClient(token, config as never);

  const end = DateTime.now();
  const dateRange = { start: end.minus({ days }).toISO()!, end: end.toISO()! };
  const report: Record<string, unknown> = { env: config.env, days, at: end.toISO() };
  const missing: string[] = [];

  // 1. Root, and each window's appointments against an exact count of that window.
  let startedAt = Date.now();
  const root = await fetchAppointmentReportResources<FhirResource>(oystehr, { dateRange });
  const appointments = root.filter((r): r is Appointment => r.resourceType === 'Appointment');
  const encounterRefs = root
    .filter((r): r is Encounter => r.resourceType === 'Encounter' && !!r.id)
    .map((r) => `Encounter/${r.id}`);
  report.root = {
    ms: Date.now() - startedAt,
    resources: root.length,
    appointments: appointments.length,
    encounters: encounterRefs.length,
  };
  console.log('root', report.root);

  const windows: unknown[] = [];
  for (const window of reportWindows(dateRange)) {
    const from = DateTime.fromISO(window.start);
    const to = DateTime.fromISO(window.end);
    const returned = appointments.filter((a) => {
      const start = a.start ? DateTime.fromISO(a.start) : undefined;
      return !!start && start >= from && start <= to;
    }).length;
    const expected = await exactCount(oystehr, 'Appointment', [
      { name: 'date', value: `ge${window.start}` },
      { name: 'date', value: `le${window.end}` },
      { name: 'status', value: ROOT_STATUSES },
      { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
    ]);
    windows.push({ window: `${window.start.slice(0, 10)}..${window.end.slice(0, 10)}`, returned, expected });
    if (returned < expected) missing.push(`root window ${window.start.slice(0, 10)}: ${returned} of ${expected}`);
  }
  report.rootWindows = windows;
  console.table(windows);

  // 2. A by-id search: every Observation of 250 visits, against an exact count.
  const probe = encounterRefs.slice(0, IDS_PER_ENTRY);
  startedAt = Date.now();
  const observations = await fetchScopedResources<Observation>(oystehr, 'Observation', 'encounter', probe);
  const expectedObservations = await exactCount(oystehr, 'Observation', [
    { name: 'encounter', value: probe.join(',') },
  ]);
  report.byIds = { ms: Date.now() - startedAt, returned: observations.length, expected: expectedObservations };
  console.log('Observation by 250 encounters', report.byIds);
  if (observations.length < expectedObservations) {
    missing.push(`Observation by encounter: ${observations.length} of ${expectedObservations}`);
  }

  // 3. A whole layer search: the vital readings of every visit.
  startedAt = Date.now();
  const vitals = await fetchScopedResources<Observation>(oystehr, 'Observation', 'encounter', encounterRefs, [
    { name: '_tag', value: Object.values(VitalFieldNames).join(',') },
  ]);
  report.vitalsLayer = {
    ms: Date.now() - startedAt,
    searches: Math.ceil(encounterRefs.length / IDS_PER_ENTRY),
    resources: vitals.length,
  };
  console.log('vitals layer', report.vitalsLayer);

  report.missing = missing;
  console.log(missing.length ? `\nMISSING:\n  ${missing.join('\n  ')}` : '\nnothing missing');

  const file = `adhoc-m0-${config.env}-${days}d-${end.toFormat('yyyyMMdd-HHmm')}.json`;
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`written ${file}`);
}

performEffectWithEnvFile(main).catch((error) => {
  console.error(error);
  process.exit(1);
});
