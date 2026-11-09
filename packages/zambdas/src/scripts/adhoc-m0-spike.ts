// M0 spike for ad-hoc reports (DESIGN-adhoc-layer-graph.md, 2.6): confirms how Oystehr runs a batch Bundle as one
// async-bulk job before the constants of the fetch helpers are trusted. READ-ONLY: searches only. Prints counts and
// times, never resource content.
//
//   npx tsx src/scripts/adhoc-m0-spike.ts <env> [days=60]
//
// Answers:
//   1. Does a batch job run at all, and what does its manifest look like (files, error files, next link)?
//   2. Does an entry's own _count apply (per entry), or only a job-wide limit?
//   3. Is the 30 000 limit per job or per entry, and does a capped job send a next link?
//   4. One job of N entries against N single jobs 8 at a time: which is faster, same resources?
//   5. How many entries one job runs before "Internal Error".
import Oystehr from '@oystehr/sdk';
import { Encounter, FhirResource } from 'fhir/r4b';
import { writeFileSync } from 'fs';
import { DateTime } from 'luxon';
import { fetchAppointmentReportResources, IDS_PER_ENTRY } from '../shared/adhoc-report';
import { getAuth0Token } from '../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../shared/helpers';
import { performEffectWithEnvFile } from './helpers';

type Entry = { resourceType: FhirResource['resourceType']; params: { name: string; value: string }[] };

const entryUrl = (e: Entry): string => `${e.resourceType}?${e.params.map((p) => `${p.name}=${p.value}`).join('&')}`;

async function download(url: string): Promise<FhirResource[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download ${response.status}`);
  return (await response.text())
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as FhirResource);
}

interface JobReport {
  label: string;
  entries: number;
  ms: number;
  status: number;
  resources: number;
  files: number;
  errorFiles: number;
  errorSample?: string;
  next: boolean;
  perType: Record<string, number>;
  failure?: string;
}

async function batchJob(oystehr: Oystehr, label: string, entries: Entry[]): Promise<JobReport & { ids: Set<string> }> {
  const startedAt = Date.now();
  const ids = new Set<string>();
  try {
    const handle = await oystehr.fhir.batch(
      { requests: entries.map((e) => ({ method: 'GET' as const, url: entryUrl(e) })) },
      { mode: 'async-bulk' }
    );
    const status = await oystehr.fhir.waitForAsyncJob(handle.jobId, { pollIntervalMs: 1000, timeoutMs: 10 * 60_000 });
    if (status.status !== 200 || !('manifest' in status)) {
      return {
        label,
        entries: entries.length,
        ms: Date.now() - startedAt,
        status: status.status,
        resources: 0,
        files: 0,
        errorFiles: 0,
        next: false,
        perType: {},
        failure: JSON.stringify(status).slice(0, 500),
        ids,
      };
    }
    const manifest = status.manifest as typeof status.manifest & { link?: { relation?: string }[] };
    const perType: Record<string, number> = {};
    for (const file of manifest.output ?? []) {
      for (const r of await download(file.url)) {
        perType[r.resourceType] = (perType[r.resourceType] ?? 0) + 1;
        ids.add(`${r.resourceType}/${r.id}`);
      }
    }
    const errorSample = manifest.error?.[0]
      ? (await fetch(manifest.error[0].url).then((r) => r.text())).slice(0, 300)
      : undefined;
    return {
      label,
      entries: entries.length,
      ms: Date.now() - startedAt,
      status: 200,
      resources: Object.values(perType).reduce((a, b) => a + b, 0),
      files: manifest.output?.length ?? 0,
      errorFiles: manifest.error?.length ?? 0,
      errorSample,
      next: !!manifest.link?.some((l) => l.relation === 'next'),
      perType,
      ids,
    };
  } catch (error) {
    return {
      label,
      entries: entries.length,
      ms: Date.now() - startedAt,
      status: -1,
      resources: 0,
      files: 0,
      errorFiles: 0,
      next: false,
      perType: {},
      failure: error instanceof Error ? error.message.slice(0, 500) : String(error),
      ids,
    };
  }
}

async function singleJobs(
  oystehr: Oystehr,
  label: string,
  entries: Entry[],
  parallel: number
): Promise<JobReport & { ids: Set<string> }> {
  const startedAt = Date.now();
  const ids = new Set<string>();
  const perType: Record<string, number> = {};
  let failure: string | undefined;
  for (let i = 0; i < entries.length; i += parallel) {
    await Promise.all(
      entries.slice(i, i + parallel).map(async (e) => {
        try {
          const handle = await oystehr.fhir.search(
            { resourceType: e.resourceType, params: e.params },
            { mode: 'async-bulk' }
          );
          const status = await oystehr.fhir.waitForAsyncJob(handle.jobId, {
            pollIntervalMs: 1000,
            timeoutMs: 10 * 60_000,
          });
          if (status.status !== 200 || !('manifest' in status)) throw new Error(`status ${status.status}`);
          for (const file of status.manifest.output ?? []) {
            for (const r of await download(file.url)) {
              perType[r.resourceType] = (perType[r.resourceType] ?? 0) + 1;
              ids.add(`${r.resourceType}/${r.id}`);
            }
          }
        } catch (error) {
          failure ??= error instanceof Error ? error.message : String(error);
        }
      })
    );
  }
  return {
    label,
    entries: entries.length,
    ms: Date.now() - startedAt,
    status: failure ? -1 : 200,
    resources: Object.values(perType).reduce((a, b) => a + b, 0),
    files: 0,
    errorFiles: 0,
    next: false,
    perType,
    failure,
    ids,
  };
}

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

async function main(config: Record<string, string>): Promise<void> {
  const days = Number(process.argv[3] ?? 60);
  const token = await getAuth0Token(config as never);
  if (!token) throw new Error('no token');
  const oystehr = createClinicalOystehrClient(token, config as never);

  const end = DateTime.now();
  const dateRange = { start: end.minus({ days }).toISO()!, end: end.toISO()! };
  const report: Record<string, unknown> = { env: config.env, days, at: end.toISO() };

  // 0. Root through the new fetch helpers (count → windows → one batch job; patients / locations by id).
  let startedAt = Date.now();
  const root = await fetchAppointmentReportResources<FhirResource>(oystehr, { dateRange });
  const encounterRefs = root
    .filter((r): r is Encounter => r.resourceType === 'Encounter' && !!r.id)
    .map((r) => `Encounter/${r.id}`);
  report.root = { ms: Date.now() - startedAt, resources: root.length, encounters: encounterRefs.length };
  console.log('root', report.root);

  const obsEntries = (refs: string[], extra: Entry['params'] = []): Entry[] =>
    chunk(refs, IDS_PER_ENTRY).map((ids) => ({
      resourceType: 'Observation',
      params: [{ name: 'encounter', value: ids.join(',') }, { name: '_count', value: '30000' }, ...extra],
    }));

  const vitalTag = [
    {
      name: '_tag',
      value:
        'vital-temperature,vital-heartbeat,vital-blood-pressure,vital-oxygen-sat,vital-respiration-rate,vital-weight,vital-height,vital-bmi,vital-vision,vital-last-menstrual-period',
    },
  ];

  // 1. A small batch job: does it run, what is in the manifest?
  const small = await batchJob(
    oystehr,
    'batch: 2 entries, vitals',
    obsEntries(encounterRefs.slice(0, IDS_PER_ENTRY * 2), vitalTag)
  );
  report.smallBatch = { ...small, ids: undefined };
  console.log(report.smallBatch);

  // 2. Per-entry _count: one entry asking for 10.
  const perEntryCount = await batchJob(oystehr, 'batch: 1 entry, _count=10', [
    {
      resourceType: 'Observation',
      params: [
        { name: 'encounter', value: encounterRefs.slice(0, IDS_PER_ENTRY).join(',') },
        { name: '_count', value: '10' },
      ],
    },
  ]);
  report.perEntryCount = {
    ...perEntryCount,
    ids: undefined,
    answer: perEntryCount.resources <= 10 ? 'per entry' : 'ignored',
  };
  console.log(report.perEntryCount);

  // 3. 30 000: all Observations (no tag) of many encounters in one job — more than 30 000 at production volume.
  const heavyEntries = obsEntries(encounterRefs.slice(0, IDS_PER_ENTRY * 40));
  const heavy = await batchJob(oystehr, 'batch: up to 40 entries, all Observations', heavyEntries);
  report.cap = {
    ...heavy,
    ids: undefined,
    answer:
      heavy.resources === 30000
        ? heavy.next
          ? 'per job, with next link'
          : 'per job, NO next link (split needed)'
        : heavy.resources > 30000
        ? 'not per job (per entry or none)'
        : 'under 30 000: not reached, use a longer range',
  };
  console.log(report.cap);

  // 4. One job of N entries against N single jobs, 8 at a time (vitals).
  const compareEntries = obsEntries(encounterRefs.slice(0, IDS_PER_ENTRY * 40), vitalTag);
  const oneJob = await batchJob(oystehr, `batch: ${compareEntries.length} entries, vitals`, compareEntries);
  const single = await singleJobs(oystehr, `single jobs: ${compareEntries.length}, 8 at a time`, compareEntries, 8);
  const sameIds = oneJob.ids.size === single.ids.size && [...oneJob.ids].every((id) => single.ids.has(id));
  report.compare = {
    batch: { ...oneJob, ids: undefined },
    single: { ...single, ids: undefined },
    sameResources: sameIds,
  };
  console.log(report.compare);

  // 5. Entries per job before Internal Error (vitals, duplicated chunks if the range is small).
  const limits: unknown[] = [];
  for (const n of [40, 80, 160]) {
    const entries = Array.from({ length: n }, (_, i) => compareEntries[i % Math.max(1, compareEntries.length)]).filter(
      Boolean
    );
    if (!entries.length) break;
    startedAt = Date.now();
    const result = await batchJob(oystehr, `batch: ${n} entries`, entries);
    limits.push({ n, ms: result.ms, status: result.status, resources: result.resources, failure: result.failure });
    console.log(limits.at(-1));
    if (result.status !== 200) break;
  }
  report.entriesPerJob = limits;

  const file = `adhoc-m0-${config.env}-${days}d-${end.toFormat('yyyyMMdd-HHmm')}.json`;
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`\nwritten ${file}`);
}

performEffectWithEnvFile(main).catch((error) => {
  console.error(error);
  process.exit(1);
});
