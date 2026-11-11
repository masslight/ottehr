// Three typical ad-hoc reports, each fetched three ways and computed to the same result, so the ways can be compared on
// time, request count and correctness. READ-ONLY. Run by scripts/adhoc-bench-reports.sh, which runs this same file in
// the current checkout ("current", "ideal") and in a worktree of the Report Studio branch ("studio").
//
//   npx tsx src/scripts/adhoc-bench-reports.ts <env> <current|ideal|studio> <r1|r2|r3> <startISO> <endISO> <out.json>
//
// Reports (a visit = an Appointment of the range with an Ottehr module tag, and its encounter that is not a follow-up
// note):
//   r1  visits per month per attending provider
//   r2  per location: visits, visits with a temperature, average latest temperature (°F)
//   r3  visits, visits with a diagnosis, visits with a CPT code, top 10 ICD-10 codes by visits
// Ways:
//   current  this version: fetchAdHocEncounterRows with the layer the report needs, result computed from its rows
//   ideal    hand-written minimal searches (only the fields the report reads), one async job per search, 16 at once
//   studio   Report Studio's runner (runFetchPlan) with a plan written the way its data map recommends
import { Appointment, Condition, Encounter, FhirResource, Observation, Procedure } from 'fhir/r4b';
import { writeFileSync } from 'fs';
import { isAnnotationFollowupEncounter } from 'utils/lib/fhir/encounter';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { getAuth0Token } from '../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../shared/helpers';
import { performEffectWithEnvFile } from './helpers';

type Oystehr = ReturnType<typeof createClinicalOystehrClient>;
type Param = { name: string; value: string };
type Range = { start: string; end: string };
type ReportId = 'r1' | 'r2' | 'r3';

const STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist,cancelled,noshow';
const MODULE_TAGS = 'OTTEHR-TM,OTTEHR-IP';

// ---- Same allowance for every way: a dropped connection is retried (never an HTTP answer) -------------------------

let networkRetries = 0;
const plainFetch = globalThis.fetch;
globalThis.fetch = async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
): Promise<Response> => {
  const request = input instanceof Request ? input : undefined;
  for (let attempt = 1; ; attempt++) {
    try {
      return await plainFetch(request ? request.clone() : input, init);
    } catch (error) {
      if (attempt >= 4 || (error as { name?: string })?.name === 'AbortError') throw error;
      networkRetries++;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// ---- The reports, computed from raw FHIR (ideal, studio) or from this version's rows (current) ---------------------

interface RawData {
  appointments: Appointment[];
  encounters: Encounter[];
  observations?: Observation[];
  conditions?: Condition[];
  procedures?: Procedure[];
}

const month = (start: string | undefined): string => (start ? new Date(start).toISOString().slice(0, 7) : 'none');
const sortKeys = <T>(obj: Record<string, T>): Record<string, T> =>
  Object.fromEntries(
    Object.keys(obj)
      .sort()
      .map((k) => [k, obj[k]])
  );
const round1 = (n: number): number => Math.round(n * 10) / 10;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** The visits: encounters of the range's appointments, follow-up notes left out. */
function rawVisits(data: RawData): { encounter: Encounter; appointment: Appointment }[] {
  const appointmentByRef = new Map(data.appointments.map((a) => [`Appointment/${a.id}`, a]));
  const seen = new Set<string>();
  const visits: { encounter: Encounter; appointment: Appointment }[] = [];
  for (const encounter of data.encounters) {
    const appointment = appointmentByRef.get(encounter.appointment?.[0]?.reference ?? '');
    if (!appointment || !encounter.id || seen.has(encounter.id) || isAnnotationFollowupEncounter(encounter)) continue;
    seen.add(encounter.id);
    visits.push({ encounter, appointment });
  }
  return visits;
}

const latestTemperatureF = (observations: Observation[]): number | null => {
  const sorted = [...observations].sort(
    (a, b) => (Date.parse(a.effectiveDateTime ?? '') || 0) - (Date.parse(b.effectiveDateTime ?? '') || 0)
  );
  const latest = sorted.at(-1);
  const value = latest?.valueQuantity?.value;
  if (typeof value !== 'number') return null;
  const unit = (latest?.valueQuantity?.unit || latest?.valueQuantity?.code || '').toUpperCase();
  return round1(unit.startsWith('F') ? value : round3((9 / 5) * value + 32));
};

type LocationStats = { visits: number; withTemperature: number; sum: number };
const locationResult = (byLocation: Map<string, LocationStats>): Record<string, unknown> =>
  sortKeys(
    Object.fromEntries(
      Array.from(byLocation, ([id, s]) => [
        id,
        {
          visits: s.visits,
          withTemperature: s.withTemperature,
          avgF: s.withTemperature ? round1(s.sum / s.withTemperature) : null,
        },
      ])
    )
  );

const codesResult = (visits: { icd: string[]; cpt: string[] }[]): Record<string, unknown> => {
  const icdVisits = new Map<string, number>();
  for (const v of visits) for (const code of new Set(v.icd)) icdVisits.set(code, (icdVisits.get(code) ?? 0) + 1);
  return {
    visits: visits.length,
    withDiagnosis: visits.filter((v) => v.icd.length).length,
    withCpt: visits.filter((v) => v.cpt.length).length,
    topIcd: Array.from(icdVisits)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10),
  };
};

const icdOf = (condition: Condition | undefined): string | undefined => {
  const codings = condition?.code?.coding ?? [];
  return (codings.find((c) => c.system?.toLowerCase().includes('icd-10')) ?? codings[0])?.code;
};

function computeRaw(report: ReportId, data: RawData): Record<string, unknown> {
  const visits = rawVisits(data);
  if (report === 'r1') {
    const counts: Record<string, number> = {};
    for (const { encounter, appointment } of visits) {
      const key = `${month(appointment.start)}|${getAttendingPractitionerId(encounter) ?? 'none'}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return sortKeys(counts);
  }
  if (report === 'r2') {
    const obsByEncounter = new Map<string, Observation[]>();
    for (const o of data.observations ?? []) {
      if (!o.meta?.tag?.some((t) => t.code === 'vital-temperature') && o.meta?.tag) continue;
      const id = o.encounter?.reference?.replace('Encounter/', '');
      if (id) obsByEncounter.set(id, [...(obsByEncounter.get(id) ?? []), o]);
    }
    const byLocation = new Map<string, LocationStats>();
    for (const { encounter, appointment } of visits) {
      const location =
        appointment.participant
          ?.find((p) => p.actor?.reference?.startsWith('Location/'))
          ?.actor?.reference?.replace('Location/', '') ?? 'none';
      const stats = byLocation.get(location) ?? { visits: 0, withTemperature: 0, sum: 0 };
      stats.visits++;
      const temperature = latestTemperatureF(obsByEncounter.get(encounter.id!) ?? []);
      if (temperature !== null) {
        stats.withTemperature++;
        stats.sum += temperature;
      }
      byLocation.set(location, stats);
    }
    return locationResult(byLocation);
  }
  const conditionById = new Map((data.conditions ?? []).map((c) => [c.id, c]));
  const cptByEncounter = new Map<string, string[]>();
  for (const p of data.procedures ?? []) {
    if (p.meta?.tag && !p.meta.tag.some((t) => t.code === 'cpt-code')) continue;
    const id = p.encounter?.reference?.replace('Encounter/', '');
    const code = p.code?.coding?.[0]?.code;
    if (id && code) cptByEncounter.set(id, [...(cptByEncounter.get(id) ?? []), code]);
  }
  return codesResult(
    visits.map(({ encounter }) => ({
      icd: (encounter.diagnosis ?? [])
        .map((d) => icdOf(conditionById.get(d.condition?.reference?.replace('Condition/', ''))))
        .filter((c): c is string => !!c),
      cpt: cptByEncounter.get(encounter.id!) ?? [],
    }))
  );
}

type Row = Record<string, unknown>;
function computeRows(report: ReportId, allRows: Row[]): Record<string, unknown> {
  const rows = allRows.filter((r) => r.encounterType !== 'follow-up');
  if (report === 'r1') {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const key = `${month(r.startTime as string)}|${(r.attendingProviderId as string) || 'none'}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return sortKeys(counts);
  }
  if (report === 'r2') {
    const byLocation = new Map<string, LocationStats>();
    for (const r of rows) {
      const location = (r.locationId as string) || 'none';
      const stats = byLocation.get(location) ?? { visits: 0, withTemperature: 0, sum: 0 };
      stats.visits++;
      if (typeof r.temperatureF === 'number') {
        stats.withTemperature++;
        stats.sum += r.temperatureF;
      }
      byLocation.set(location, stats);
    }
    return locationResult(byLocation);
  }
  return codesResult(rows.map((r) => ({ icd: (r.icdCodes as string[]) ?? [], cpt: (r.cptCodes as string[]) ?? [] })));
}

// ---- Groups: where the time went -----------------------------------------------------------------------------------

interface Group {
  name: string;
  ms: number;
  requests?: number;
  resources?: number;
  error?: string;
}

// ---- ideal: hand-written minimal searches ----------------------------------------------------------------------------

const IDEAL_JOBS = 16;
const IDEAL_IDS = 500;
const IDEAL_WINDOW_DAYS = 15;

function limiter(max: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: (() => void)[] = [];
  return async (task) => {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

async function asyncSearch(
  oystehr: Oystehr,
  slot: ReturnType<typeof limiter>,
  group: Group,
  resourceType: FhirResource['resourceType'],
  params: Param[]
): Promise<FhirResource[]> {
  const { resources, next } = await slot(async () => {
    const handle = await oystehr.fhir.search(
      { resourceType, params: [...params.filter((p) => p.name !== '_count'), { name: '_count', value: '30000' }] },
      { mode: 'async-bulk' }
    );
    const status = await oystehr.fhir.waitForAsyncJob(handle.jobId, { pollIntervalMs: 1000, timeoutMs: 15 * 60_000 });
    group.requests = (group.requests ?? 0) + 1;
    if (status.status !== 200 || !('manifest' in status))
      throw new Error(`${resourceType}: job answered ${status.status}`);
    if (status.manifest.error?.length) throw new Error(`${resourceType}: job wrote an error file`);
    const out: FhirResource[] = [];
    for (const file of status.manifest.output ?? []) {
      const text = await (await fetch(file.url)).text();
      for (const line of text.split('\n')) if (line.trim()) out.push(JSON.parse(line) as FhirResource);
    }
    const link = (status.manifest as { link?: { relation?: string; url?: string }[] }).link?.find(
      (l) => l.relation === 'next'
    )?.url;
    if (out.length >= 30000 && !link) throw new Error(`${resourceType}: 30 000 without a next link`);
    return { resources: out, next: link };
  });
  if (!next) return resources;
  const nextParams = Array.from(new URLSearchParams(next.split('?')[1] ?? ''), ([name, value]) => ({ name, value }));
  return [...resources, ...(await asyncSearch(oystehr, slot, group, resourceType, nextParams))];
}

const windows = (range: Range): Range[] => {
  const out: Range[] = [];
  let cursor = Date.parse(range.start);
  const end = Date.parse(range.end);
  while (cursor < end) {
    const next = Math.min(cursor + IDEAL_WINDOW_DAYS * 86_400_000, end);
    out.push({ start: new Date(cursor).toISOString(), end: new Date(next).toISOString() });
    cursor = next + 1;
  }
  return out;
};

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

const dedupe = <T extends FhirResource>(items: FhirResource[]): T[] => {
  const seen = new Set<string>();
  return items.filter((r) => {
    const key = `${r.resourceType}/${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }) as T[];
};

async function runIdeal(
  oystehr: Oystehr,
  report: ReportId,
  range: Range
): Promise<{ result: Record<string, unknown>; groups: Group[]; requests: number }> {
  const slot = limiter(IDEAL_JOBS);
  const groups: Group[] = [];
  const timed = async <T>(name: string, run: (group: Group) => Promise<T>): Promise<T> => {
    const group: Group = { name, ms: 0 };
    groups.push(group);
    const startedAt = Date.now();
    try {
      return await run(group);
    } finally {
      group.ms = Date.now() - startedAt;
    }
  };
  const byWindows = (
    name: string,
    type: FhirResource['resourceType'],
    dateParam: string,
    params: Param[]
  ): Promise<FhirResource[]> =>
    timed(name, async (group) => {
      const parts = await Promise.all(
        windows(range).map((w) =>
          asyncSearch(oystehr, slot, group, type, [
            { name: dateParam, value: `ge${w.start}` },
            { name: dateParam, value: `le${w.end}` },
            ...params,
          ])
        )
      );
      const out = dedupe(parts.flat());
      group.resources = out.length;
      return out;
    });
  const byIds = (
    name: string,
    type: FhirResource['resourceType'],
    param: string,
    ids: string[],
    params: Param[]
  ): Promise<FhirResource[]> =>
    timed(name, async (group) => {
      const parts = await Promise.all(
        chunks(Array.from(new Set(ids)), IDEAL_IDS).map((chunk) =>
          asyncSearch(oystehr, slot, group, type, [{ name: param, value: chunk.join(',') }, ...params])
        )
      );
      const out = dedupe(parts.flat());
      group.resources = out.length;
      return out;
    });

  // Stage 1: the visits — appointments and their encounters by the appointment's date, side by side, trimmed.
  const encounterElements = [
    'id',
    'appointment',
    'type',
    'partOf',
    'participant',
    ...(report === 'r3' ? ['diagnosis'] : []),
  ];
  const [appointments, encounters] = await Promise.all([
    byWindows('appointments', 'Appointment', 'date', [
      { name: 'status', value: STATUSES },
      { name: '_tag', value: MODULE_TAGS },
      { name: '_elements', value: report === 'r2' ? 'id,start,participant' : 'id,start' },
    ]) as Promise<Appointment[]>,
    byWindows('encounters', 'Encounter', 'appointment.date', [
      { name: '_elements', value: encounterElements.join(',') },
    ]) as Promise<Encounter[]>,
  ]);
  const data: RawData = { appointments, encounters };
  const visits = rawVisits(data);
  const encounterRefs = visits.map((v) => `Encounter/${v.encounter.id}`);

  // Stage 2: what the report reads besides the visits, by the visits' ids.
  if (report === 'r1') {
    await byIds(
      'practitioners',
      'Practitioner',
      '_id',
      visits.map((v) => getAttendingPractitionerId(v.encounter) ?? '').filter(Boolean),
      [{ name: '_elements', value: 'id,name' }]
    );
  }
  if (report === 'r2') {
    const locationIds = visits
      .map((v) => v.appointment.participant?.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor?.reference)
      .filter((r): r is string => !!r)
      .map((r) => r.replace('Location/', ''));
    const [observations] = await Promise.all([
      byIds('temperatures', 'Observation', 'encounter', encounterRefs, [
        { name: '_tag', value: 'vital-temperature' },
        { name: '_elements', value: 'id,encounter,valueQuantity,effectiveDateTime' },
      ]) as Promise<Observation[]>,
      byIds('locations', 'Location', '_id', locationIds, [{ name: '_elements', value: 'id,name' }]),
    ]);
    data.observations = observations;
  }
  if (report === 'r3') {
    const conditionIds = visits.flatMap((v) =>
      (v.encounter.diagnosis ?? []).map((d) => d.condition?.reference?.replace('Condition/', '') ?? '').filter(Boolean)
    );
    const [conditions, procedures] = await Promise.all([
      byIds('diagnoses', 'Condition', '_id', conditionIds, [{ name: '_elements', value: 'id,code' }]) as Promise<
        Condition[]
      >,
      byIds('cpt codes', 'Procedure', 'encounter', encounterRefs, [
        { name: '_tag', value: 'cpt-code' },
        { name: '_elements', value: 'id,encounter,code' },
      ]) as Promise<Procedure[]>,
    ]);
    data.conditions = conditions;
    data.procedures = procedures;
  }

  return { result: computeRaw(report, data), groups, requests: groups.reduce((n, g) => n + (g.requests ?? 0), 0) };
}

// ---- studio: Report Studio's runner with plans written the way its data map recommends ------------------------------

const studioPlan = (report: ReportId): unknown => {
  const steps: Record<string, unknown>[] = [
    {
      id: 'visits',
      resourceType: 'Appointment',
      params: [
        { name: 'date', value: 'ge{{start}}' },
        { name: 'date', value: 'le{{end}}' },
        { name: 'status', value: STATUSES },
        { name: '_tag', value: MODULE_TAGS },
      ],
      elements: report === 'r2' ? ['id', 'start', 'participant'] : ['id', 'start'],
    },
    {
      id: 'encounters',
      resourceType: 'Encounter',
      params: [
        { name: 'appointment.date', value: 'ge{{start}}' },
        { name: 'appointment.date', value: 'le{{end}}' },
      ],
      elements: ['id', 'appointment', 'type', 'partOf', 'participant', ...(report === 'r3' ? ['diagnosis'] : [])],
    },
  ];
  if (report === 'r1') {
    steps.push({
      id: 'practitioners',
      resourceType: 'Practitioner',
      from: { step: 'encounters', path: 'participant.individual.reference', param: '_id', keepType: 'Practitioner' },
      elements: ['id', 'name'],
    });
  }
  if (report === 'r2') {
    steps.push(
      {
        id: 'temperatures',
        resourceType: 'Observation',
        params: [{ name: '_tag', value: 'vital-temperature' }],
        from: { step: 'encounters', path: 'id', param: 'encounter' },
        elements: ['id', 'encounter', 'valueQuantity', 'effectiveDateTime'],
      },
      {
        id: 'locations',
        resourceType: 'Location',
        from: { step: 'visits', path: 'participant.actor.reference', param: '_id', keepType: 'Location' },
        elements: ['id', 'name'],
      }
    );
  }
  if (report === 'r3') {
    steps.push(
      {
        id: 'diagnoses',
        resourceType: 'Condition',
        from: { step: 'encounters', path: 'diagnosis.condition.reference', param: '_id', keepType: 'Condition' },
        elements: ['id', 'code'],
      },
      {
        id: 'cptCodes',
        resourceType: 'Procedure',
        params: [{ name: '_tag', value: 'cpt-code' }],
        from: { step: 'encounters', path: 'id', param: 'encounter' },
        elements: ['id', 'encounter', 'code'],
      }
    );
  }
  return { version: 1, steps };
};

const load = async (spec: string): Promise<Record<string, unknown>> => {
  const mod = (await import(spec)) as Record<string, unknown>;
  return (mod.default as Record<string, unknown>) ?? mod;
};

async function runStudio(
  oystehr: Oystehr,
  report: ReportId,
  range: Range
): Promise<{ result: Record<string, unknown>; groups: Group[]; requests: number }> {
  const planTypes = await load('utils/lib/types/adhoc/plan/fetch-plan');
  const runner = await load('../shared/adhoc-fetch-plan');
  const plan = (planTypes.FetchPlanSchema as { parse: (v: unknown) => unknown }).parse(studioPlan(report));
  const { resources, stats } = (await (runner.runFetchPlan as (...args: unknown[]) => Promise<unknown>)(
    oystehr,
    plan,
    range,
    undefined,
    undefined
  )) as {
    resources: Record<string, FhirResource[]>;
    stats: { id: string; ms: number; count: number; requests: number; mode: string; error?: string }[];
  };
  const failed = stats.find((s) => s.error);
  if (failed) throw new Error(`step ${failed.id}: ${failed.error}`);
  const result = computeRaw(report, {
    appointments: (resources.visits ?? []) as Appointment[],
    encounters: (resources.encounters ?? []) as Encounter[],
    observations: resources.temperatures as Observation[] | undefined,
    conditions: resources.diagnoses as Condition[] | undefined,
    procedures: resources.cptCodes as Procedure[] | undefined,
  });
  return {
    result,
    groups: stats.map((s) => ({ name: `${s.id} (${s.mode})`, ms: s.ms, requests: s.requests, resources: s.count })),
    requests: stats.reduce((n, s) => n + s.requests, 0),
  };
}

// ---- current: this version's encounters dataset ---------------------------------------------------------------------

async function runCurrent(
  oystehr: Oystehr,
  report: ReportId,
  range: Range,
  environment: string
): Promise<{ result: Record<string, unknown>; groups: Group[]; requests: number }> {
  const dataset = await load('../shared/adhoc-datasets/encounters');
  const flags = report === 'r2' ? { includeVitals: true } : report === 'r3' ? { includeCodes: true } : {};

  // This version logs its own breakdown; keep it, and count its jobs.
  let timing = '';
  let jobs = 0;
  const log = console.log;
  console.log = (...args: unknown[]): void => {
    const line = args.map(String).join(' ');
    if (line.startsWith('[adhoc] encounters timing')) timing = line;
    if (line.startsWith('[adhoc]') && line.includes(' job=')) jobs++;
  };
  let rows: Row[];
  try {
    rows = (await (dataset.fetchAdHocEncounterRows as (...args: unknown[]) => Promise<Row[]>)(
      oystehr,
      { dateRange: range, ...flags },
      { environment }
    )) as Row[];
  } finally {
    console.log = log;
  }

  const groups: Group[] = [];
  const match = /root ms=(\d+) layers ms=(\d+) map ms=(\d+) \| (.*)$/.exec(timing);
  if (match) {
    groups.push({ name: 'root', ms: Number(match[1]) }, { name: 'base lookups + layers', ms: Number(match[2]) });
    for (const part of match[4].split(', ').filter(Boolean)) {
      const layer = /^(\w+): fetch (\d+)/.exec(part);
      if (layer) groups.push({ name: `  layer ${layer[1]}`, ms: Number(layer[2]) });
    }
    groups.push({ name: 'rows (map)', ms: Number(match[3]) });
  }
  return { result: computeRows(report, rows), groups, requests: jobs };
}

// ---- main -----------------------------------------------------------------------------------------------------------

async function main(config: Record<string, string>): Promise<void> {
  const [, , , way, report, start, end, out] = process.argv as [
    string,
    string,
    string,
    'current' | 'ideal' | 'studio',
    ReportId,
    string,
    string,
    string,
  ];
  const token = await getAuth0Token(config as never);
  if (!token) throw new Error('no token');
  const oystehr = createClinicalOystehrClient(token, config as never);
  const range = { start, end };

  const startedAt = Date.now();
  let output: Record<string, unknown>;
  try {
    const run =
      way === 'ideal'
        ? await runIdeal(oystehr, report, range)
        : way === 'studio'
        ? await runStudio(oystehr, report, range)
        : await runCurrent(oystehr, report, range, config.ENVIRONMENT ?? '');
    output = { ms: Date.now() - startedAt, ...run };
  } catch (error) {
    output = {
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
    };
  }
  output.networkRetries = networkRetries;
  writeFileSync(out, JSON.stringify(output));
  process.stdout.write(
    `[bench-reports] ${way} ${report} ms=${output.ms}${output.error ? ` ERROR ${output.error}` : ''}\n`
  );
}

performEffectWithEnvFile(main).catch((error) => {
  console.error(error);
  process.exit(1);
});
