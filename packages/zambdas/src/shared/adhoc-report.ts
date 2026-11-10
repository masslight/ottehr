import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { randomUUID } from 'crypto';
import {
  Address,
  Appointment,
  Encounter,
  FhirResource,
  Location,
  Patient,
  Practitioner,
  RelatedPerson,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BUCKET_NAMES, SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { getEncounterVisitType, isScheduledFollowupEncounter } from 'utils/lib/fhir/encounter';
import { isInPersonAppointment, isTelemedAppointment, OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { getAddressForIndividual, getFirstName, getLastName, getMiddleName } from 'utils/lib/fhir/patient';
import { getAdmitterPractitionerId, getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import {
  ADHOC_REPORT_OUTPUT_URL_CODE,
  ADHOC_REPORT_PARAMS_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
  AdHocReportStatus,
  GetAdHocReportStatusInput,
  GetAdHocReportStatusInputSchema,
  StartAdHocReportInput,
  StartAdHocReportInputSchema,
} from 'utils/lib/types/adhoc/generation/report-task';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { getInPersonVisitStatus } from 'utils/lib/utils/visitUtils';
import { gzipSync } from 'zlib';
import { ZambdaInput } from './types/common';
import { safeJsonParse, safeValidate } from './validation';
import { createPresignedUrl } from './z3Utils';

export type AdHocReportRequest =
  | (StartAdHocReportInput & { secrets: Secrets })
  | (GetAdHocReportStatusInput & { secrets: Secrets });

export function validateAdHocReportRequest(input: ZambdaInput): AdHocReportRequest {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsedJSON = safeJsonParse(input.body) as Record<string, unknown>;

  if ('taskId' in parsedJSON && parsedJSON.taskId) {
    const parsed = safeValidate(GetAdHocReportStatusInputSchema, parsedJSON);
    return { ...parsed, secrets: input.secrets };
  }

  const parsed = safeValidate(StartAdHocReportInputSchema, parsedJSON);

  return { ...parsed, secrets: input.secrets };
}

export async function createAdHocReportTask(
  oystehr: Oystehr,
  code: string,
  params: StartAdHocReportInput
): Promise<Task> {
  const task = await oystehr.fhir.create<Task>({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    code: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code }] },
    input: [
      {
        type: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_REPORT_PARAMS_CODE }] },
        valueString: JSON.stringify({
          datasetId: params.datasetId,
          dateRange: params.dateRange,
          options: params.options ?? {},
        }),
      },
    ],
  });

  if (!task.id) throw new Error('Ad-hoc report Task was created without an id');

  return task;
}

export async function adHocReportTaskStatus(
  task: Task,
  expectedCode: string,
  token: string
): Promise<AdHocReportStatus> {
  const isExpectedTask =
    task.code?.coding?.some((c) => c.system === ADHOC_REPORT_TASK_SYSTEM && c.code === expectedCode) ?? false;

  if (!isExpectedTask) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Task/${task.id} is not an ad-hoc report`);

  if (task.status === 'completed') {
    const outputUrl = task.output?.find((o) => o.type?.coding?.some((c) => c.code === ADHOC_REPORT_OUTPUT_URL_CODE))
      ?.valueString;

    if (!outputUrl) return { status: 'failed', error: 'Report completed but produced no data file' };

    const downloadUrl = await createPresignedUrl(token, outputUrl, 'download');

    return { status: 'completed', downloadUrl };
  }

  const failed = ['failed', 'cancelled', 'rejected', 'entered-in-error'];
  if (failed.includes(task.status)) {
    return {
      status: 'failed',
      error: task.statusReason?.text || task.statusReason?.coding?.[0]?.code || 'Report failed',
    };
  }

  return { status: task.status === 'in-progress' ? 'in-progress' : 'requested' };
}

/**
 * The report data as stored in Z3: gzip, about 10–14 % of the JSON. The browser inflates it itself
 * (DecompressionStream), so the stored object needs no Content-Encoding.
 */
export function gzipReportJson(json: string): Blob {
  return new Blob([new Uint8Array(gzipSync(Buffer.from(json, 'utf8')))], { type: 'application/gzip' });
}

export async function uploadAdHocReportJsonToZ3(
  oystehr: Oystehr,
  secrets: Secrets | null,
  json: string
): Promise<string> {
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const projectApi = getSecret(SecretsKeys.PROJECT_API, secrets);
  const bucketName = `${projectId}-${BUCKET_NAMES.REPORTS}`;
  const objectPath = `adhoc-report-${randomUUID()}.json.gz`;

  await oystehr.z3.uploadFile({
    bucketName,
    'objectPath+': objectPath,
    file: gzipReportJson(json),
  });

  return `${projectApi}/z3/${bucketName}/${objectPath}`;
}

export async function uploadAdHocReportDataToZ3(
  oystehr: Oystehr,
  secrets: Secrets | null,
  token: string,
  json: string
): Promise<string> {
  const z3Url = await uploadAdHocReportJsonToZ3(oystehr, secrets, json);
  return createPresignedUrl(token, z3Url, 'download');
}

const REPORT_BUDGET_MS = 13 * 60 * 1000;

const DEFAULT_JOB_TIMEOUT_MS = 10 * 60 * 1000;

// Job status poll. A job of a few entries is often done in ~1 s; polling every 2 s cost up to 2 s per job.
const JOB_POLL_INTERVAL_MS = 1000;

let reportDeadlineMs = 0;

export function beginReportBudget(): void {
  reportDeadlineMs = Date.now() + REPORT_BUDGET_MS;
}

function jobWait(): { pollIntervalMs: number; timeoutMs: number } {
  if (reportDeadlineMs === 0) return { pollIntervalMs: JOB_POLL_INTERVAL_MS, timeoutMs: DEFAULT_JOB_TIMEOUT_MS };
  const remaining = reportDeadlineMs - Date.now();
  if (remaining <= 0) throw new Error('Ad-hoc report exceeded its time budget before all data was fetched');
  return { pollIntervalMs: JOB_POLL_INTERVAL_MS, timeoutMs: remaining };
}

const FAILURE_BODY_CHARS = 800;

// The bulk output files are downloaded here rather than through the SDK's waitForAsyncBulkOutput.
// Measured: the manifest reports requiresAccessToken=true, so the SDK adds an Authorization header,
// and the storage rejects a pre-signed url that also carries one with "400". The same url fetched
// with no auth at all returns 200. The SDK offers no way to skip the header — it throws when the
// manifest asks for a token and none is given.
async function downloadNdjson<T extends FhirResource>(url: string): Promise<T[]> {
  // fetch has no timeout of its own, so a stalled download would hang until the lambda itself is
  // killed, ignoring the report budget. Bound it by whatever is left of that budget — and jobWait
  // throws first when nothing is left, so an already-doomed download never starts.
  const { timeoutMs } = jobWait();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      throw new Error(
        `downloading ${url.split('?')[0]} answered ${response.status}: ${(await response.text()).slice(
          0,
          FAILURE_BODY_CHARS
        )}`
      );
    }
    const ndjson = await response.text();
    const resources: T[] = [];
    for (const line of ndjson.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) resources.push(JSON.parse(trimmed) as T);
    }
    return resources;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Fetch helpers: one async-bulk job per search ------------------------------------------------
//
// Every report search runs as an async-bulk job (start → poll → download). A search set is cut into bounded
// searches — the windows of a date range (DEFAULT_WINDOW_DAYS) or the id chunks of an id list (IDS_PER_ENTRY)
// — and each runs as its own job, JOBS_IN_PARALLEL at once.
//
// Why not one batch-Bundle job per set (the first plan): the M0 spike measured that a search inside an async
// batch job ignores its own _count and stops at 1 000 resources, and a larger result can come back empty — with
// no error and no next link (OTR-3686 again). A batch job's output does not say which search returned what, so
// that loss cannot even be detected. One job per search is what the reports ran before, with _count=30000.
//
// The async job removes the limit on what the server may SEND, not on what one query may RUN: a search that
// runs too long fails with "Internal Error". Such a search is split in two (its window or its id list) and run
// again, up to MAX_SPLIT_DEPTH levels; then the report fails. A part of the data is never returned.

// Two knobs can be overridden by environment variables for tuning runs (bench, local server); when unset or not a
// positive whole number, the defaults below apply. Change the defaults here once the runs have settled them.
const tuning = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

/** Ids in one search (`_id=a,b,…` / `encounter=…`). 250 was set for sync searches (14 s limit); ADHOC_IDS_PER_SEARCH. */
export const IDS_PER_ENTRY = tuning('ADHOC_IDS_PER_SEARCH', 250);
/** Days in one date window: ~1 400 appointments at ~91 a day on production, far under one 30 000 page. */
export const DEFAULT_WINDOW_DAYS = 15;
/** Async jobs one report runs at once; 8 was the knee on production (SC: 4 → 18.3 s, 8 → 11.0 s, 16 → 9.0 s); ADHOC_JOBS_IN_PARALLEL. */
export const JOBS_IN_PARALLEL = tuning('ADHOC_JOBS_IN_PARALLEL', 8);
/** Halvings of one search before the report fails. */
const MAX_SPLIT_DEPTH = 3;
/** The most resources one async-bulk result page holds; without _count a job returns 1 000 (OTR-3686). */
const ASYNC_BULK_MAX_RESULTS = 30000;

type SearchParam = { name: string; value: string };

/** One bounded search. `split` halves it (its window or its id list) when its job fails. */
interface SearchEntry {
  resourceType: FhirResource['resourceType'];
  params: SearchParam[];
  split?: () => [SearchEntry, SearchEntry] | undefined;
}

/**
 * A job that a smaller search may pass: the job failed after it was accepted (Internal Error, the 30 s database
 * limit), a 5xx or a timeout when it was started, an error file, a capped result.
 */
class SplittableJobFailure extends Error {}

/**
 * At most `max` tasks at once. Only a job (start → poll → download) goes through it, and a job waits for
 * nothing else in the limiter, so it cannot deadlock. Splits and next links run after the slot is free.
 */
function createLimiter(max: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: (() => void)[] = [];
  const release = (): void => {
    active--;
    queue.shift()?.();
  };
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

const jobSlot = createLimiter(JOBS_IN_PARALLEL);

const isSplittableStatus = (status: unknown): boolean =>
  typeof status !== 'number' || status >= 500 || status === 408 || status === 429;

async function readErrorFile(url: string): Promise<string> {
  try {
    const response = await fetch(url, { method: 'GET' });
    return (await response.text()).slice(0, FAILURE_BODY_CHARS);
  } catch (error) {
    return `could not read the error file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

interface JobResult {
  resources: FhirResource[];
  nextUrl?: string;
}

async function runJob(oystehr: Oystehr, entry: SearchEntry, label: string): Promise<JobResult> {
  const params = [
    ...entry.params.filter((p) => p.name !== '_count'),
    { name: '_count', value: `${ASYNC_BULK_MAX_RESULTS}` },
  ];
  const startedAt = Date.now();
  let jobId = '';
  try {
    const handle = await oystehr.fhir.search({ resourceType: entry.resourceType, params }, { mode: 'async-bulk' });
    jobId = handle.jobId;
    const status = await oystehr.fhir.waitForAsyncJob(jobId, jobWait());

    if (status.status !== 200 || !('mode' in status) || status.mode !== 'bulk') {
      const detail =
        'outcome' in status ? status.outcome : 'body' in status ? (status as { body?: unknown }).body : undefined;
      const message = `job answered status ${status.status}, mode ${'mode' in status ? status.mode : 'none'} ${
        detail === undefined ? '' : JSON.stringify(detail).slice(0, FAILURE_BODY_CHARS)
      }`;
      // A job the server accepted and then failed is a query that did not finish — on local, a 1 000-id search ran
      // into the 30 s database limit and the job answered 400 with no body. A smaller search can pass, so it is
      // split. A bad request is refused when the job is started (the search call throws), not here.
      throw new SplittableJobFailure(message);
    }

    const errorFiles = status.manifest.error ?? [];
    if (errorFiles.length) {
      throw new SplittableJobFailure(
        `job wrote ${errorFiles.length} error file(s): ${await readErrorFile(errorFiles[0].url)}`
      );
    }

    const files = await Promise.all(
      (status.manifest.output ?? []).map(async (file) => ({
        type: file.type,
        resources: await downloadNdjson(file.url),
      }))
    );
    const resources = files.flatMap((file) => file.resources);

    // OYST-3505: a result over one page carries a next link in the manifest.
    const nextUrl = (status.manifest as { link?: { relation?: string; url?: string }[] }).link?.find(
      (link) => link.relation === 'next'
    )?.url;

    console.log(
      `[adhoc] ${label}: job=${jobId} ms=${Date.now() - startedAt} files=${files.length} ` +
        `resources=${resources.length}${nextUrl ? ' next=yes' : ''} ` +
        `perFile=${JSON.stringify(files.map((file) => ({ type: file.type, count: file.resources.length })))}`
    );

    return { resources, nextUrl };
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    console.error(
      `[adhoc] ${label}: FAILED job=${jobId || 'not started'} ms=${Date.now() - startedAt} ` +
        `code=${code ?? 'none'} message=${error instanceof Error ? error.message : String(error)}`
    );
    if (error instanceof SplittableJobFailure) throw error;
    // An error thrown by the SDK (start or poll) or a failed download: a 5xx, a timeout or a network error may
    // pass as a smaller search, a 4xx will not.
    if (isSplittableStatus(code)) {
      throw new SplittableJobFailure(error instanceof Error ? error.message : String(error));
    }
    captureException(error, { extra: { label, jobId, params } });
    throw error;
  }
}

// A next link is the original search with an offset: it runs as a job of its own, with the same checks.
function entryFromNextUrl(entry: SearchEntry, nextUrl: string): SearchEntry {
  const params = Array.from(new URLSearchParams(nextUrl.split('?')[1] ?? ''), ([name, value]) => ({
    name,
    value,
  })).filter((p) => p.name !== '_count');
  return { resourceType: entry.resourceType, params };
}

async function runEntry(oystehr: Oystehr, entry: SearchEntry, label: string, depth: number): Promise<FhirResource[]> {
  let result: JobResult;
  try {
    result = await jobSlot(() => runJob(oystehr, entry, label));
  } catch (error) {
    if (!(error instanceof SplittableJobFailure)) {
      throw new Error(
        `Could not load ${label} for the report: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return splitAndRun(oystehr, entry, label, depth, error.message);
  }

  // A full page and no next link: the rest was dropped without an error (problem 6).
  if (result.resources.length >= ASYNC_BULK_MAX_RESULTS && !result.nextUrl) {
    return splitAndRun(oystehr, entry, label, depth, `${result.resources.length} resources without a next link`);
  }

  const rest = result.nextUrl ? await runEntry(oystehr, entryFromNextUrl(entry, result.nextUrl), label, depth) : [];
  return [...result.resources, ...rest];
}

async function splitAndRun(
  oystehr: Oystehr,
  entry: SearchEntry,
  label: string,
  depth: number,
  reason: string
): Promise<FhirResource[]> {
  const halves = entry.split?.();

  if (depth >= MAX_SPLIT_DEPTH || !halves) {
    throw new Error(
      `Could not load ${label} for the report completely (${reason}) after ${depth} split(s); ` +
        'the report is stopped rather than shown with missing data'
    );
  }

  console.warn(`[adhoc] ${label}: split depth=${depth + 1} reason=${reason}`);

  const parts = await Promise.all(halves.map((half) => runEntry(oystehr, half, label, depth + 1)));
  return parts.flat();
}

/** Runs each search as its own job, at most JOBS_IN_PARALLEL at once; each resource once. */
async function runEntries<T extends FhirResource>(
  oystehr: Oystehr,
  entries: SearchEntry[],
  label: string
): Promise<T[]> {
  if (entries.length === 0) return [];
  const startedAt = Date.now();

  const parts = await Promise.all(entries.map((entry) => runEntry(oystehr, entry, label, 0)));

  const out: T[] = [];
  const seen = new Set<string>();
  for (const resource of parts.flat()) {
    // An included or revincluded resource can come back from two searches (a follow-up of two windows).
    const key = `${resource.resourceType}/${resource.id}`;
    if (resource.id && seen.has(key)) continue;
    if (resource.id) seen.add(key);
    out.push(resource as T);
  }

  console.log(`[adhoc] ${label}: searches=${entries.length} resources=${out.length} ms=${Date.now() - startedAt}`);
  return out;
}

const REPORT_APPOINTMENT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist,cancelled,noshow';

export const REPORT_ATTENDED_APPOINTMENT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist';

export function reportWindows(
  dateRange: { start: string; end: string },
  windowDays = DEFAULT_WINDOW_DAYS
): { start: string; end: string }[] {
  // setZone keeps the offset the range was given in, so window bounds read like the range itself.
  const start = DateTime.fromISO(dateRange.start, { setZone: true });
  const end = DateTime.fromISO(dateRange.end, { setZone: true });
  if (!start.isValid || !end.isValid || end <= start) return [dateRange];

  const windows: { start: string; end: string }[] = [];
  let cursor = start;
  while (cursor < end) {
    const next = DateTime.min(cursor.plus({ milliseconds: Math.max(1, Math.round(windowDays * 86_400_000)) }), end);
    windows.push({ start: cursor.toISO()!, end: next.toISO()! });
    // `date=ge`/`le` include both bounds, so step off the boundary by a millisecond to keep an appointment out of two windows.
    cursor = next.plus({ milliseconds: 1 });
  }
  return windows;
}

/** One date-window search; it halves its window when its job fails. */
function windowEntry(
  resourceType: FhirResource['resourceType'],
  dateParam: string,
  window: { start: string; end: string },
  params: SearchParam[]
): SearchEntry {
  return {
    resourceType,
    params: [{ name: dateParam, value: `ge${window.start}` }, { name: dateParam, value: `le${window.end}` }, ...params],
    split: () => {
      const start = DateTime.fromISO(window.start, { setZone: true });
      const end = DateTime.fromISO(window.end, { setZone: true });
      const middle = start.plus({ milliseconds: Math.floor(end.diff(start).as('milliseconds') / 2) });
      if (!start.isValid || !end.isValid || middle <= start || middle >= end) return undefined;
      return [
        windowEntry(resourceType, dateParam, { start: window.start, end: middle.toISO()! }, params),
        windowEntry(
          resourceType,
          dateParam,
          { start: middle.plus({ milliseconds: 1 }).toISO()!, end: window.end },
          params
        ),
      ];
    },
  };
}

/** One id-chunk search; it halves its id list when its job fails. */
function idsEntry(
  resourceType: FhirResource['resourceType'],
  paramName: string,
  ids: string[],
  params: SearchParam[]
): SearchEntry {
  return {
    resourceType,
    params: [{ name: paramName, value: ids.join(',') }, ...params],
    split: () =>
      ids.length > 1
        ? [
            idsEntry(resourceType, paramName, ids.slice(0, Math.ceil(ids.length / 2)), params),
            idsEntry(resourceType, paramName, ids.slice(Math.ceil(ids.length / 2)), params),
          ]
        : undefined,
  };
}

const participantIds = (appointments: Appointment[], type: 'Patient' | 'Location'): string[] =>
  Array.from(
    new Set(
      appointments.flatMap((appointment) =>
        (appointment.participant ?? [])
          .map((p) => p.actor?.reference)
          .filter((ref): ref is string => !!ref?.startsWith(`${type}/`))
          .map((ref) => ref.replace(`${type}/`, ''))
      )
    )
  );

/**
 * The report's root: the appointments of the range with their encounters (`_revinclude`), then their
 * patients, locations and attending / intake practitioners by id — once each for the whole report, not as
 * an `_include` in every window. Returns all of them in one list, as before.
 */
export async function fetchAppointmentReportResources<T extends FhirResource>(
  oystehr: Oystehr,
  opts: {
    dateRange: { start: string; end: string };
    extraParams?: { name: string; value: string }[];
    statuses?: string;
  }
): Promise<T[]> {
  const startedAt = Date.now();
  const params: SearchParam[] = [
    { name: 'status', value: opts.statuses ?? REPORT_APPOINTMENT_STATUSES },
    { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
    { name: '_revinclude', value: 'Encounter:appointment' },
    ...(opts.extraParams ?? []),
  ];
  const entries = reportWindows(opts.dateRange).map((window) => windowEntry('Appointment', 'date', window, params));

  const root = await runEntries<Appointment | Encounter>(oystehr, entries, 'Appointment by date');
  const appointments = root.filter((r): r is Appointment => r.resourceType === 'Appointment');

  const [patients, locations, practitioners] = await Promise.all([
    fetchScopedResources<Patient>(oystehr, 'Patient', '_id', participantIds(appointments, 'Patient')),
    fetchScopedResources<Location>(oystehr, 'Location', '_id', participantIds(appointments, 'Location')),
    fetchAttendingPractitioners<Practitioner>(oystehr, root),
  ]);

  const out = [...root, ...patients, ...locations, ...practitioners] as T[];
  console.log(`[adhoc] report root: windows=${entries.length} resources=${out.length} ms=${Date.now() - startedAt}`);
  return out;
}

const ORDER_AUTHORED_LEAD_DAYS = 7;
const ORDER_AUTHORED_MAX_SPAN_DAYS = 90;
const ORDER_WINDOW_DAYS = 7;

export async function fetchOrdersByAuthoredDate<T extends FhirResource>(
  oystehr: Oystehr,
  dateRange: { start: string; end: string },
  params: { name: string; value: string }[]
): Promise<T[] | undefined> {
  const start = DateTime.fromISO(dateRange.start).minus({ days: ORDER_AUTHORED_LEAD_DAYS });
  const now = DateTime.now();

  if (!start.isValid || now.diff(start, 'days').days > ORDER_AUTHORED_MAX_SPAN_DAYS) return undefined;

  const entries = reportWindows({ start: start.toISO()!, end: now.toISO()! }, ORDER_WINDOW_DAYS).map((window) =>
    windowEntry('ServiceRequest', 'authored', window, params)
  );

  return runEntries<T>(oystehr, entries, 'ServiceRequest by authored');
}

// (Temporarily, while async-bulk isn't working as expected): the attending providers used to ride along on the main search as _include:iterate through the
// Encounter, which made every window carry a fourth resource type in full. Only the attending and the
// intake (admitter) participants are ever read — their name and the provider-type extension — so they
// are fetched separately: by id, in batches, three fields each — the same shape as every other heavy
// part of a report.
async function fetchAttendingPractitioners<T extends FhirResource>(
  oystehr: Oystehr,
  resources: FhirResource[]
): Promise<T[]> {
  const ids = new Set<string>();
  for (const resource of resources) {
    if (resource.resourceType !== 'Encounter') continue;

    for (const id of [
      getAttendingPractitionerId(resource as Encounter),
      getAdmitterPractitionerId(resource as Encounter),
    ]) {
      if (id) ids.add(id);
    }
  }

  if (ids.size === 0) return [];

  return fetchScopedResources<T>(oystehr, 'Practitioner', '_id', Array.from(ids), [
    { name: '_elements', value: 'id,name,extension' },
  ]);
}

/** Resources whose `paramName` is one of `values`: one async job per id chunk of IDS_PER_ENTRY. */
export async function fetchScopedResources<T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  paramName: string,
  values: string[],
  extraParams: { name: string; value: string }[] = []
): Promise<T[]> {
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (unique.length === 0) return [];

  const entries: SearchEntry[] = [];
  for (let i = 0; i < unique.length; i += IDS_PER_ENTRY) {
    entries.push(idsEntry(resourceType, paramName, unique.slice(i, i + IDS_PER_ENTRY), extraParams));
  }

  return runEntries<T>(oystehr, entries, `${resourceType} by ${paramName}`);
}

export function resolveEncounterAppointment(
  encounter: Encounter,
  appointmentMap: Map<string, Appointment>,
  encounterById: Map<string, Encounter>
): Appointment | undefined {
  const ownRef = encounter.appointment?.[0]?.reference;
  const own = ownRef ? appointmentMap.get(ownRef) : undefined;

  if (own) return own;

  // A scheduled follow-up is a visit of its own: not loaded means outside the range, never the parent's visit.
  if (isScheduledFollowupEncounter(encounter)) return undefined;

  const parentId = encounter.partOf?.reference?.replace('Encounter/', '');
  const parentRef = parentId ? encounterById.get(parentId)?.appointment?.[0]?.reference : undefined;

  return parentRef ? appointmentMap.get(parentRef) : undefined;
}

export interface EncounterRowContext {
  encounterType: 'main' | 'follow-up' | 'scheduled-follow-up';
  isFollowUpRow: boolean;
  patient: Patient | undefined;
  locationRef: string | undefined;
  location: Location | undefined;
  attendingId: string | undefined;
  attendingProvider: string;
  visitType: 'In-Person' | 'Telemed' | 'Unknown';
  visitStatus: string;
  serviceCategory: string;
  address: Address | undefined;
  start: string;
}

export function buildEncounterRowContext(
  encounter: Encounter,
  appointment: Appointment,
  lookups: {
    encounterById: Map<string, Encounter>;
    patientMap: Map<string, Patient>;
    locationMap: Map<string, Location>;
    practitionerMap: Map<string, Practitioner>;
  }
): EncounterRowContext {
  const { encounterById, patientMap, locationMap, practitionerMap } = lookups;

  const encounterType = getEncounterVisitType(encounter) ?? 'main';

  // Only an annotation follow-up is a note on its parent visit (no Appointment of its own, status and lock on the
  // Encounter). A scheduled follow-up is a visit converted in place — its own Appointment, status and lock.
  const isFollowUpRow = encounterType === 'follow-up';

  const parentEncounter = encounter.partOf?.reference
    ? encounterById.get(encounter.partOf.reference.replace('Encounter/', ''))
    : undefined;

  const patientRef = encounter.subject?.reference ?? parentEncounter?.subject?.reference;
  const patient = patientRef ? patientMap.get(patientRef) : undefined;

  const locationRef = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor
    ?.reference;

  const location = locationRef ? locationMap.get(locationRef) : undefined;

  const attendingId = getAttendingPractitionerId(encounter);
  const attendingPractitioner = attendingId ? practitionerMap.get(attendingId) : undefined;

  const attendingProvider = attendingPractitioner
    ? `${attendingPractitioner.name?.[0]?.given?.[0] || ''} ${attendingPractitioner.name?.[0]?.family || ''}`.trim()
    : 'Unknown';

  const visitType = isTelemedAppointment(appointment)
    ? 'Telemed'
    : isInPersonAppointment(appointment)
    ? 'In-Person'
    : 'Unknown';

  const visitStatus = isFollowUpRow
    ? encounter.status === 'finished'
      ? 'completed'
      : encounter.status
    : getInPersonVisitStatus(appointment, encounter, true);

  const svcCoding = (appointment.serviceCategory ?? [])
    .flatMap((sc) => sc.coding ?? [])
    .find((c) => c.system === SERVICE_CATEGORY_SYSTEM);

  const serviceCategory = svcCoding?.display || svcCoding?.code || '';

  const address = patient ? getAddressForIndividual(patient) : undefined;
  const start = (isFollowUpRow ? encounter.period?.start : appointment.start) || '';

  return {
    encounterType,
    isFollowUpRow,
    patient,
    locationRef,
    location,
    attendingId,
    attendingProvider,
    visitType,
    visitStatus,
    serviceCategory,
    address,
    start,
  };
}

export const presentFullName = (individual: Patient | Practitioner | RelatedPerson | undefined): string =>
  individual?.name?.[0]
    ? [getFirstName(individual), getMiddleName(individual), getLastName(individual)].filter(Boolean).join(' ')
    : '';

/** `value` when it is one of `allowed` (a closed vocabulary the schema enumerates), else null. */
export const knownValueOrNull = <T extends string>(allowed: readonly T[], value: string | undefined): T | null =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
