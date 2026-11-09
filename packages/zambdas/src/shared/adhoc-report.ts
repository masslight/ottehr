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

export async function uploadAdHocReportJsonToZ3(
  oystehr: Oystehr,
  secrets: Secrets | null,
  json: string
): Promise<string> {
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const projectApi = getSecret(SecretsKeys.PROJECT_API, secrets);
  const bucketName = `${projectId}-${BUCKET_NAMES.REPORTS}`;
  const objectPath = `adhoc-report-${randomUUID()}.json`;

  await oystehr.z3.uploadFile({
    bucketName,
    'objectPath+': objectPath,
    file: new Blob([json], { type: 'application/json' }),
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

// ---- Fetch helpers: async batch jobs -----------------------------------------------------------
//
// Every report search runs as a batch Bundle in ONE async-bulk job: the entries of a search set (the
// windows of a date range, or the 250-id chunks of an id list) go into one request, so the ~2.5 s fixed
// cost of a job is paid once per ENTRIES_PER_JOB entries instead of once per window or chunk.
//
// The async job removes the limit on what the server may SEND, not on what one query may RUN: each
// entry is one database query, and a query that runs too long fails with "Internal Error". So an entry
// stays bounded (a window of ≈ RECORDS_PER_WINDOW appointments, or IDS_PER_ENTRY ids), and a job that
// fails that way is split in two and run again — up to MAX_SPLIT_DEPTH levels, then the report fails.
// A part of the data is never returned.
//
// The start values below are set by the M0 spike (see DESIGN-adhoc-layer-graph.md, 2.6).

/** Ids in one search entry (`_id=a,b,…` / `encounter=…`). 1 000 hit the 14 s query limit on production. */
export const IDS_PER_ENTRY = 250;
/** Search entries in one batch job. 40 × 250 ids ≈ 0.4 MB of request, far under the 6 MiB cap. */
export const ENTRIES_PER_JOB = 40;
/** Appointments in one date window; the window size in days comes from a count of the range. */
export const RECORDS_PER_WINDOW = 5000;
/** Window size when the range is short, or when the count fails. */
export const DEFAULT_WINDOW_DAYS = 15;
/** Ranges up to this many days are not counted first: a count costs more than it saves there. */
export const COUNT_MIN_RANGE_DAYS = 30;
/** Async jobs one report runs at once. One job, from start to download, holds one slot. */
export const JOBS_IN_PARALLEL = 4;
/** Split levels for a failed job before the report fails. */
const MAX_SPLIT_DEPTH = 3;
/** The most resources one async-bulk result page holds; without _count a job returns 1 000. */
const ASYNC_BULK_MAX_RESULTS = 30000;

type SearchParam = { name: string; value: string };

/** One search of a batch job: one bounded database query. `split` halves it when a job of this one entry fails. */
interface SearchEntry {
  resourceType: string;
  params: SearchParam[];
  split?: () => [SearchEntry, SearchEntry] | undefined;
}

/** A job that failed in a way a smaller job may not: Internal Error, an error file, a 5xx, a capped result. */
class SplittableJobFailure extends Error {}

/** A job that a smaller job would not fix: a 4xx answer (a bad parameter, no access). */
class FatalJobFailure extends Error {}

/**
 * At most `max` tasks at once. Only a job (start → poll → download) goes through it: a job waits for
 * nothing else in the limiter, so the limiter cannot deadlock. Splits and next links run after the slot
 * is free.
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

// The SDK splits each entry's query on "&" and "=" and encodes the values itself, so values go in raw.
function entryUrl(entry: SearchEntry): string {
  const params = [
    ...entry.params.filter((p) => p.name !== '_count'),
    { name: '_count', value: `${ASYNC_BULK_MAX_RESULTS}` },
  ];
  for (const p of params) {
    if (p.value.includes('&') || p.value.includes('=')) {
      throw new Error(`Ad-hoc search value for ${p.name} cannot contain "&" or "=": ${p.value}`);
    }
  }
  return `${entry.resourceType}?${params.map((p) => `${p.name}=${p.value}`).join('&')}`;
}

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

async function runJob(oystehr: Oystehr, entries: SearchEntry[], label: string): Promise<JobResult> {
  const startedAt = Date.now();
  let jobId = '';
  try {
    const handle = await oystehr.fhir.batch(
      { requests: entries.map((entry) => ({ method: 'GET' as const, url: entryUrl(entry) })) },
      { mode: 'async-bulk' }
    );
    jobId = handle.jobId;
    const status = await oystehr.fhir.waitForAsyncJob(jobId, jobWait());

    if (status.status !== 200 || !('mode' in status) || status.mode !== 'bulk') {
      const outcome = 'outcome' in status ? JSON.stringify(status.outcome).slice(0, FAILURE_BODY_CHARS) : '';
      const message = `job answered status ${status.status}, mode ${
        'mode' in status ? status.mode : 'none'
      } ${outcome}`;
      if (isSplittableStatus(status.status)) throw new SplittableJobFailure(message);
      throw new FatalJobFailure(message);
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
      `[adhoc] ${label}: job=${jobId} entries=${entries.length} ms=${Date.now() - startedAt} files=${files.length} ` +
        `resources=${resources.length}${nextUrl ? ' next=yes' : ''} ` +
        `perFile=${JSON.stringify(files.map((file) => ({ type: file.type, count: file.resources.length })))}`
    );

    return { resources, nextUrl };
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    console.error(
      `[adhoc] ${label}: FAILED job=${jobId || 'not started'} entries=${entries.length} ms=${Date.now() - startedAt} ` +
        `code=${code ?? 'none'} message=${error instanceof Error ? error.message : String(error)}`
    );
    if (error instanceof SplittableJobFailure) throw error;
    // An error thrown by the SDK (start or poll) or a failed download: a 5xx, a timeout or a network error may
    // pass in a smaller job, a 4xx will not.
    if (!(error instanceof FatalJobFailure) && isSplittableStatus(code)) {
      throw new SplittableJobFailure(error instanceof Error ? error.message : String(error));
    }
    captureException(error, { extra: { label, jobId } });
    throw error;
  }
}

// A next link is the original search with an offset: it runs as a job of its own, with the same checks.
function entryFromNextUrl(nextUrl: string): SearchEntry {
  const [path, query = ''] = nextUrl.split('?');
  const resourceType = path.split('/').filter(Boolean).at(-1) ?? '';
  if (!/^[A-Z][A-Za-z]+$/.test(resourceType)) throw new Error(`Ad-hoc report: unsupported next link ${path}`);
  const params = Array.from(new URLSearchParams(query), ([name, value]) => ({ name, value })).filter(
    (p) => p.name !== '_count'
  );
  return { resourceType, params };
}

async function runGroup(oystehr: Oystehr, group: SearchEntry[], label: string, depth: number): Promise<FhirResource[]> {
  let result: JobResult;
  try {
    result = await jobSlot(() => runJob(oystehr, group, label));
  } catch (error) {
    if (!(error instanceof SplittableJobFailure)) {
      throw new Error(
        `Could not load ${label} for the report: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return splitAndRun(oystehr, group, label, depth, error.message);
  }

  // Exactly one full page and no next link: the rest was dropped without an error (problem 6).
  if (result.resources.length >= ASYNC_BULK_MAX_RESULTS && !result.nextUrl) {
    return splitAndRun(oystehr, group, label, depth, `${result.resources.length} resources without a next link`);
  }

  const rest = result.nextUrl ? await runGroup(oystehr, [entryFromNextUrl(result.nextUrl)], label, depth) : [];
  return [...result.resources, ...rest];
}

async function splitAndRun(
  oystehr: Oystehr,
  group: SearchEntry[],
  label: string,
  depth: number,
  reason: string
): Promise<FhirResource[]> {
  const halves: SearchEntry[][] | undefined =
    group.length > 1
      ? [group.slice(0, Math.ceil(group.length / 2)), group.slice(Math.ceil(group.length / 2))]
      : group[0]?.split?.()?.map((entry) => [entry]);

  if (depth >= MAX_SPLIT_DEPTH || !halves) {
    throw new Error(
      `Could not load ${label} for the report completely (${reason}) after ${depth} split(s); ` +
        'the report is stopped rather than shown with missing data'
    );
  }

  console.warn(`[adhoc] ${label}: split depth=${depth + 1} entries=${group.length} reason=${reason}`);

  const parts = await Promise.all(halves.map((half) => runGroup(oystehr, half, label, depth + 1)));
  return parts.flat();
}

/** Runs the entries in batch jobs of ENTRIES_PER_JOB, at most JOBS_IN_PARALLEL at once; each resource once. */
async function runEntries<T extends FhirResource>(
  oystehr: Oystehr,
  entries: SearchEntry[],
  label: string
): Promise<T[]> {
  if (entries.length === 0) return [];
  const startedAt = Date.now();
  const groups: SearchEntry[][] = [];
  for (let i = 0; i < entries.length; i += ENTRIES_PER_JOB) groups.push(entries.slice(i, i + ENTRIES_PER_JOB));

  const parts = await Promise.all(groups.map((group) => runGroup(oystehr, group, label, 0)));

  const out: T[] = [];
  const seen = new Set<string>();
  for (const resource of parts.flat()) {
    // An included or revincluded resource can come back from two entries (a Patient shared by windows).
    const key = `${resource.resourceType}/${resource.id}`;
    if (resource.id && seen.has(key)) continue;
    if (resource.id) seen.add(key);
    out.push(resource as T);
  }

  console.log(
    `[adhoc] ${label}: entries=${entries.length} jobs=${groups.length} resources=${out.length} ms=${
      Date.now() - startedAt
    }`
  );
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

/** One date-window entry; it halves itself when a job of this one window fails. */
function windowEntry(
  resourceType: string,
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

/** One id-chunk entry; it halves its id list when a job of this one chunk fails. */
function idsEntry(resourceType: string, paramName: string, ids: string[], params: SearchParam[]): SearchEntry {
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

/**
 * Window size for a range: one count of the matching appointments, then ≈ RECORDS_PER_WINDOW per window.
 * The count changes only the partition, never the data: when it fails, the windows are DEFAULT_WINDOW_DAYS.
 */
async function appointmentWindowDays(
  oystehr: Oystehr,
  dateRange: { start: string; end: string },
  params: SearchParam[]
): Promise<number> {
  const rangeDays = DateTime.fromISO(dateRange.end).diff(DateTime.fromISO(dateRange.start), 'days').days;
  if (!Number.isFinite(rangeDays) || rangeDays <= COUNT_MIN_RANGE_DAYS) return DEFAULT_WINDOW_DAYS;

  try {
    const bundle = await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [
        { name: 'date', value: `ge${dateRange.start}` },
        { name: 'date', value: `le${dateRange.end}` },
        ...params,
        { name: '_summary', value: 'count' },
        { name: '_total', value: 'accurate' },
      ],
    });
    const count = bundle.total ?? 0;
    // `_summary=count` reports 1 on an empty project: a count that small cannot size anything.
    if (count <= 1) return DEFAULT_WINDOW_DAYS;
    const days = Math.max(1, (rangeDays * RECORDS_PER_WINDOW) / count);
    console.log(`[adhoc] Appointment count=${count} rangeDays=${Math.round(rangeDays)} windowDays=${days.toFixed(1)}`);
    return days;
  } catch (error) {
    console.warn(
      `[adhoc] Appointment count failed, windows of ${DEFAULT_WINDOW_DAYS} days: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return DEFAULT_WINDOW_DAYS;
  }
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
  const filters: SearchParam[] = [
    { name: 'status', value: opts.statuses ?? REPORT_APPOINTMENT_STATUSES },
    { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
  ];

  const windowDays = await appointmentWindowDays(oystehr, opts.dateRange, filters);
  const params: SearchParam[] = [
    ...filters,
    { name: '_revinclude', value: 'Encounter:appointment' },
    ...(opts.extraParams ?? []),
  ];
  const entries = reportWindows(opts.dateRange, windowDays).map((window) =>
    windowEntry('Appointment', 'date', window, params)
  );

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

/** Resources whose `paramName` is one of `values`, in id chunks of IDS_PER_ENTRY, batch jobs of ENTRIES_PER_JOB. */
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
