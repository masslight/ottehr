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

const JOB_POLL_INTERVAL_MS = 1000;

let reportDeadlineMs = 0;

export function beginReportBudget(): void {
  reportDeadlineMs = Date.now() + REPORT_BUDGET_MS;
}

export function reportDeadline(): number | undefined {
  return reportDeadlineMs || undefined;
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

const tuning = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export const IDS_PER_ENTRY = tuning('ADHOC_IDS_PER_SEARCH', 500);
export const DEFAULT_WINDOW_DAYS = 15;
export const JOBS_IN_PARALLEL = tuning('ADHOC_JOBS_IN_PARALLEL', 16);
const syncPages = (): number => {
  const value = Number(process.env.ADHOC_SYNC_PAGES);
  return Number.isInteger(value) && value >= 0 ? value : 6;
};
const syncPageSize = (): number => tuning('ADHOC_SYNC_PAGE_SIZE', 500);
const MAX_SPLIT_DEPTH = 3;
const ASYNC_BULK_MAX_RESULTS = 30000;

type SearchParam = { name: string; value: string };

interface SearchEntry {
  resourceType: FhirResource['resourceType'];
  params: SearchParam[];
  split?: () => [SearchEntry, SearchEntry] | undefined;
}

class SplittableJobFailure extends Error {}

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
    if (isSplittableStatus(code)) {
      throw new SplittableJobFailure(error instanceof Error ? error.message : String(error));
    }
    captureException(error, { extra: { label, jobId, params } });
    throw error;
  }
}

function entryFromNextUrl(entry: SearchEntry, nextUrl: string): SearchEntry {
  const params = Array.from(new URLSearchParams(nextUrl.split('?')[1] ?? ''), ([name, value]) => ({
    name,
    value,
  })).filter((p) => p.name !== '_count');
  return { resourceType: entry.resourceType, params };
}

async function runSync(oystehr: Oystehr, entry: SearchEntry, label: string): Promise<FhirResource[] | undefined> {
  const pages = syncPages();
  if (pages === 0) return undefined;
  const size = syncPageSize();
  const params = entry.params.filter((p) => p.name !== '_count' && p.name !== '_offset');
  const startedAt = Date.now();

  type Page = { resources: FhirResource[]; hasNext: boolean; total?: number };
  const fetchPage = async (page: number): Promise<Page> => {
    const bundle: { unbundle: () => FhirResource[]; link?: { relation?: string }[]; total?: number } = await jobSlot(
      () =>
        oystehr.fhir.search({
          resourceType: entry.resourceType,
          params: [
            ...params,
            { name: '_count', value: `${size}` },
            { name: '_offset', value: `${page * size}` },
            ...(page === 0 ? [{ name: '_total', value: 'accurate' }] : []),
          ],
        })
    );
    return {
      resources: bundle.unbundle().filter((r) => r.resourceType !== 'OperationOutcome'),
      hasNext: !!bundle.link?.some((link) => link.relation === 'next'),
      total: bundle.total,
    };
  };

  let result: Page[];
  try {
    const first = await fetchPage(0);
    result = [first];
    if (first.hasNext) {
      const needed = typeof first.total === 'number' && first.total > 0 ? Math.ceil(first.total / size) : pages;
      if (needed > pages) {
        console.log(`[adhoc] ${label}: job=sync ${first.total} matches, more than ${pages} pages: an async job`);
        return undefined;
      }
      result.push(...(await Promise.all(Array.from({ length: needed - 1 }, (_, i) => fetchPage(i + 1)))));
    }
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (isSplittableStatus(code) || code === 413) {
      console.warn(
        `[adhoc] ${label}: a sync page failed (code=${code ?? 'none'}), running it as an async job: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return undefined;
    }
    throw error;
  }

  const last = result.findIndex((page) => !page.hasNext);
  if (last === -1) {
    console.log(`[adhoc] ${label}: job=sync more than ${pages} pages, running it as an async job`);
    return undefined;
  }
  const out = result.slice(0, last + 1).flatMap((page) => page.resources);
  console.log(`[adhoc] ${label}: job=sync pages=${last + 1} ms=${Date.now() - startedAt} resources=${out.length}`);
  return out;
}

async function runEntry(oystehr: Oystehr, entry: SearchEntry, label: string, depth: number): Promise<FhirResource[]> {
  if (depth === 0 && !entry.params.some((p) => p.name === '_offset')) {
    const sync = await runSync(oystehr, entry, label);
    if (sync) return sync;
  }
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

export async function fetchReportAppointments(
  oystehr: Oystehr,
  opts: {
    dateRange: { start: string; end: string };
    extraParams?: { name: string; value: string }[];
    statuses?: string;
  }
): Promise<(Appointment | Encounter)[]> {
  const params: SearchParam[] = [
    { name: 'status', value: opts.statuses ?? REPORT_APPOINTMENT_STATUSES },
    { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
    { name: '_revinclude', value: 'Encounter:appointment' },
    ...(opts.extraParams ?? []),
  ];
  const entries = reportWindows(opts.dateRange).map((window) => windowEntry('Appointment', 'date', window, params));
  return runEntries<Appointment | Encounter>(oystehr, entries, 'Appointment by date');
}

export async function fetchReportVisits(
  oystehr: Oystehr,
  opts: {
    dateRange: { start: string; end: string };
    statuses?: string;
    onAppointments?: (appointments: Appointment[]) => void;
  }
): Promise<(Appointment | Encounter)[]> {
  const byDate = <T extends FhirResource>(
    resourceType: FhirResource['resourceType'],
    dateParam: string,
    params: SearchParam[],
    label: string
  ): Promise<T[]> => {
    const startedAt = Date.now();
    return runEntries<T>(
      oystehr,
      reportWindows(opts.dateRange).map((window) => windowEntry(resourceType, dateParam, window, params)),
      label
    ).then((found) => {
      console.log(`[adhoc] visits ${label}: ms=${Date.now() - startedAt} resources=${found.length}`);
      return found;
    });
  };

  const [appointments, encounters, chainedFollowUps] = await Promise.all([
    byDate<Appointment>(
      'Appointment',
      'date',
      [
        { name: 'status', value: opts.statuses ?? REPORT_APPOINTMENT_STATUSES },
        { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
      ],
      'Appointment by date'
    ).then((found) => {
      opts.onAppointments?.(found.filter((a) => a.resourceType === 'Appointment'));
      return found;
    }),
    byDate<Encounter>('Encounter', 'appointment.date', [], 'Encounter by appointment date'),
    byDate<Encounter>('Encounter', 'part-of.appointment.date', [], 'Encounter by parent appointment date').catch(
      (error) => {
        console.warn(
          `[adhoc] Encounter by parent appointment date refused, follow-ups by parent id instead: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return undefined;
      }
    ),
  ]);

  const visits = appointments.filter((a) => a.resourceType === 'Appointment');
  const appointmentRefs = new Set(visits.map((a) => `Appointment/${a.id}`));
  const kept = new Map<string, Encounter>();
  for (const e of encounters) {
    if (
      e.resourceType === 'Encounter' &&
      e.id &&
      e.appointment?.some((a) => a.reference && appointmentRefs.has(a.reference))
    )
      kept.set(e.id, e);
  }

  let followUps = chainedFollowUps ?? [];
  if (!chainedFollowUps) {
    followUps = await fetchScopedResources<Encounter>(
      oystehr,
      'Encounter',
      'part-of',
      Array.from(kept.keys()).map((id) => `Encounter/${id}`)
    );
  }
  const candidates = [...encounters, ...followUps].filter((e) => e.resourceType === 'Encounter');
  for (let grew = true; grew; ) {
    grew = false;
    for (const e of candidates) {
      const parent = e.partOf?.reference?.replace('Encounter/', '');
      if (e.id && !kept.has(e.id) && parent && kept.has(parent)) {
        kept.set(e.id, e);
        grew = true;
      }
    }
  }

  return [...visits, ...kept.values()];
}

export async function fetchAppointmentParticipants(
  oystehr: Oystehr,
  appointments: Appointment[]
): Promise<{ patients: Patient[]; locations: Location[] }> {
  const [patients, locations] = await Promise.all([
    fetchScopedResources<Patient>(oystehr, 'Patient', '_id', participantIds(appointments, 'Patient')),
    fetchScopedResources<Location>(oystehr, 'Location', '_id', participantIds(appointments, 'Location')),
  ]);
  return { patients, locations };
}

export async function fetchReportRootLookups(
  oystehr: Oystehr,
  root: FhirResource[]
): Promise<{ patients: Patient[]; locations: Location[]; practitioners: Practitioner[] }> {
  const appointments = root.filter((r): r is Appointment => r.resourceType === 'Appointment');
  const [patients, locations, practitioners] = await Promise.all([
    fetchScopedResources<Patient>(oystehr, 'Patient', '_id', participantIds(appointments, 'Patient')),
    fetchScopedResources<Location>(oystehr, 'Location', '_id', participantIds(appointments, 'Location')),
    fetchAttendingPractitioners<Practitioner>(oystehr, root),
  ]);
  return { patients, locations, practitioners };
}

export async function fetchAppointmentReportResources<T extends FhirResource>(
  oystehr: Oystehr,
  opts: {
    dateRange: { start: string; end: string };
    extraParams?: { name: string; value: string }[];
    statuses?: string;
  }
): Promise<T[]> {
  const startedAt = Date.now();
  const root = await fetchReportAppointments(oystehr, opts);
  const { patients, locations, practitioners } = await fetchReportRootLookups(oystehr, root);
  const out = [...root, ...patients, ...locations, ...practitioners] as T[];
  console.log(`[adhoc] report root: resources=${out.length} ms=${Date.now() - startedAt}`);
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
export async function fetchAttendingPractitioners<T extends FhirResource>(
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
