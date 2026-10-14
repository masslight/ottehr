import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import {
  Address,
  Appointment,
  Encounter,
  FhirResource,
  Location,
  OperationOutcome,
  Patient,
  Practitioner,
  RelatedPerson,
} from 'fhir/r4b';
import { BUCKET_NAMES, SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { getEncounterVisitType } from 'utils/lib/fhir/encounter';
import { isInPersonAppointment, isTelemedAppointment, OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { getAddressForIndividual, getFirstName, getLastName, getMiddleName } from 'utils/lib/fhir/patient';
import { getAdmitterPractitionerId, getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { isResponseSizeExceededError } from 'utils/lib/fhir/responseSize';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { getInPersonVisitStatus } from 'utils/lib/utils/visitUtils';
import { gzipSync } from 'zlib';
import { createPresignedUrl } from './z3Utils';

export async function uploadAdHocReportJsonToZ3(
  oystehr: Oystehr,
  secrets: Secrets | null,
  json: string,
  gzip = false
): Promise<string> {
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const projectApi = getSecret(SecretsKeys.PROJECT_API, secrets);
  const bucketName = `${projectId}-${BUCKET_NAMES.REPORTS}`;
  const objectPath = `adhoc-report-${randomUUID()}.json${gzip ? '.gz' : ''}`;
  await oystehr.z3.uploadFile({
    bucketName,
    'objectPath+': objectPath,
    file: gzip
      ? new Blob([gzipSync(json)], { type: 'application/gzip' })
      : new Blob([json], { type: 'application/json' }),
  });
  return `${projectApi}/z3/${bucketName}/${objectPath}`;
}

export async function uploadAdHocReportDataToZ3(
  oystehr: Oystehr,
  secrets: Secrets | null,
  token: string,
  json: string,
  gzip = false
): Promise<string> {
  const z3Url = await uploadAdHocReportJsonToZ3(oystehr, secrets, json, gzip);
  return createPresignedUrl(token, z3Url, 'download');
}

const REPORT_BUDGET_MS = 13 * 60 * 1000;

const DEFAULT_JOB_TIMEOUT_MS = 10 * 60 * 1000;

// Request-scoped so one zambda's deadline never leaks into another on the shared local server.
const reportDeadline = new AsyncLocalStorage<number>();

export const runWithReportBudget = <T>(fn: () => Promise<T>): Promise<T> =>
  reportDeadline.run(Date.now() + REPORT_BUDGET_MS, fn);

function jobWait(): { pollIntervalMs: number; timeoutMs: number } {
  const reportDeadlineMs = reportDeadline.getStore();
  if (reportDeadlineMs === undefined) return { pollIntervalMs: 2000, timeoutMs: DEFAULT_JOB_TIMEOUT_MS };
  const remaining = reportDeadlineMs - Date.now();
  if (remaining <= 0) throw new Error('Ad-hoc report exceeded its time budget before all data was fetched');
  return { pollIntervalMs: 2000, timeoutMs: remaining };
}

const FAILURE_BODY_CHARS = 800;

async function logAsyncJobFailure(oystehr: Oystehr, jobId: string, label: string): Promise<void> {
  if (!jobId) return;
  try {
    const status = (await oystehr.fhir.getAsyncJob(jobId)) as {
      status?: number;
      mode?: string;
      outcome?: OperationOutcome;
      manifest?: { output?: { url?: string }[]; requiresAccessToken?: boolean };
      bundle?: unknown;
      body?: unknown;
    };
    const parts = [`status=${status.status ?? 'none'}`, `mode=${status.mode ?? 'none'}`];
    if (status.outcome) parts.push(`outcome=${JSON.stringify(status.outcome).slice(0, FAILURE_BODY_CHARS)}`);
    if (status.manifest) {
      parts.push(
        `manifestFiles=${status.manifest.output?.length ?? 0}`,
        `requiresAccessToken=${status.manifest.requiresAccessToken ?? 'none'}`
      );
    }

    if (status.body && !status.manifest && !status.bundle) {
      parts.push(`body=${JSON.stringify(status.body).slice(0, FAILURE_BODY_CHARS)}`);
    }

    console.error(`[adhoc] ${label}: job ${jobId} ${parts.join(' ')}`);
  } catch (error) {
    console.error(
      `[adhoc] ${label}: could not read job ${jobId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

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

// Oystehr's SearchEngine caps an async-bulk job at this many PRIMARY resources (maxAsyncSearchResults) — without
// `_count` at 1,000 — and drops the matches past it silently (no error, no next link). Included resources are not
// counted. Measured on synth 2026-10-14: 161,116 Observations, `_count=100000` → 30,000, `_count=29999` → 29,999.
export const ASYNC_BULK_MAX = 30_000;

/** A bulk job returned as many primary resources as its `_count` allows, so the server may have dropped matches. */
export class AsyncBulkCapError extends Error {}

// TEMPORARY WORKAROUND: the async-bulk output drops the Bundle's next link and total, so a job that returns exactly
// its `_count` of primary resources is the only sign the server cut the result. Reported to Oystehr; a next link on
// bulk results is expected. When it arrives, replace this check (the one place the cap is detected — the split in
// searchSplittingOnCap only reacts to the error it throws) with following the next link.
function assertBulkJobUnderCap(label: string, resourceType: string, primary: number, cap: number): void {
  if (primary >= cap) {
    throw new AsyncBulkCapError(`${label}: ${primary} ${resourceType} matched, the most one bulk job returns`);
  }
}

export async function searchAsyncBulk<T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  params: { name: string; value: string }[]
): Promise<T[]> {
  const label = `${resourceType} by ${params.map((p) => p.name).join(',')}`;
  const startedAt = Date.now();
  const cap = Number(params.find((p) => p.name === '_count')?.value ?? ASYNC_BULK_MAX);
  if (!params.some((p) => p.name === '_count')) params = [...params, { name: '_count', value: String(cap) }];
  let jobId = '';
  try {
    const handle = await oystehr.fhir.search<T>({ resourceType, params }, { mode: 'async-bulk' });
    jobId = handle.jobId;
    const status = await oystehr.fhir.waitForAsyncJob<T>(jobId, jobWait());
    if (status.status !== 200 || !('mode' in status) || status.mode !== 'bulk') {
      throw new Error(`job answered status ${status.status}, mode ${'mode' in status ? status.mode : 'none'}`);
    }

    const files = await Promise.all(
      (status.manifest.output ?? []).map(async (file) => ({
        type: file.type,
        resources: await downloadNdjson<T>(file.url),
      }))
    );
    const resources = files.flatMap((file) => file.resources);
    console.log(
      `[adhoc] ${label}: job=${jobId} ms=${Date.now() - startedAt} files=${files.length} ` +
        `resources=${resources.length} ` +
        `perFile=${JSON.stringify(files.map((file) => ({ type: file.type, count: file.resources.length })))}`
    );
    assertBulkJobUnderCap(label, resourceType, resources.filter((r) => r.resourceType === resourceType).length, cap);
    return resources;
  } catch (error) {
    if (error instanceof AsyncBulkCapError) throw error;
    console.error(
      `[adhoc] ${label}: FAILED job=${jobId || 'not started'} ms=${Date.now() - startedAt} ` +
        `code=${(error as { code?: unknown })?.code ?? 'none'} message=${
          error instanceof Error ? error.message : String(error)
        }`
    );

    await logAsyncJobFailure(oystehr, jobId, label);

    captureException(error, { extra: { resourceType, jobId, params } });

    // The server's code rides along so a caller can tell a search too heavy for the server from a bad one.
    throw Object.assign(
      new Error(
        `Could not load ${resourceType} for the report (job ${jobId || 'not started'}): ${
          error instanceof Error ? error.message : String(error)
        }`
      ),
      { code: (error as { code?: unknown })?.code }
    );
  }
}

/**
 * A search the server could not finish: cut off at 14 s (HTTP 504) or answering more than 6 MiB (HTTP 413, code
 * 4130). The SDK puts the body's code, else the HTTP status, on the error's `code`.
 */
export const isSearchTooHeavyError = (error: unknown): boolean => {
  const code = Number((error as { code?: unknown })?.code);
  return code === 504 || code === 413 || isResponseSizeExceededError(error);
};

/** The most times a unit is halved after a too-heavy failure (the bulk cap keeps its own floor: one day, one id). */
export const MAX_ERROR_SPLITS = 3;

export interface SplitRetryOptions {
  /** Besides the bulk cap, split the unit on these errors too (isSearchTooHeavyError), at most MAX_ERROR_SPLITS times. */
  splitOn?: (error: unknown) => boolean;
  /** For the failure message: the resource type, and the smallest unit the search can be cut to ("a single day", "a single id"). */
  label?: string;
  floor?: string;
}

/**
 * Runs `search` for one unit of work (a date window, a batch of ids). A job that fills the bulk cap may have
 * dropped matches, so its result is discarded and both halves are searched instead — down to a unit `split`
 * cannot halve (one day, one id), which fails rather than hand back a partial result. A failure `splitOn`
 * accepts is halved the same way, a bounded number of times.
 */
export async function searchSplittingOnCap<U, T extends FhirResource>(
  unit: U,
  search: (unit: U) => Promise<T[]>,
  split: (unit: U) => [U, U] | undefined,
  options: SplitRetryOptions = {},
  errorSplits = 0
): Promise<T[]> {
  try {
    return await search(unit);
  } catch (error) {
    const onCap = error instanceof AsyncBulkCapError;
    if (!onCap && !options.splitOn?.(error)) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    const halves = split(unit);
    if (onCap) {
      if (!halves) throw new Error(`${reason}; the search cannot be split any further`);
    } else {
      const what = options.label ?? 'the search';
      const advice = 'the search is probably too broad — check its filters and _include';
      if (!halves) {
        throw new Error(
          options.floor
            ? `${options.floor} of ${what} still fails (${reason}); ${advice}`
            : `${what} still fails and cannot be split (${reason}); ${advice}`
        );
      }
      if (errorSplits >= MAX_ERROR_SPLITS) {
        throw new Error(`${what} still fails after splitting ${errorSplits} times (${reason}); ${advice}`);
      }
      errorSplits += 1;
    }
    const [a, b] = await Promise.all(
      halves.map((half) => searchSplittingOnCap(half, search, split, options, errorSplits))
    );
    return dedupeResources([...a, ...b]);
  }
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The two halves of a date window; none for a window of a day or less. */
export function halveWindow(window: { start: string; end: string }): [DateRange, DateRange] | undefined {
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  if (!(end - start > DAY_MS)) return undefined;
  const mid = start + Math.floor((end - start) / 2);
  return [
    { start: window.start, end: new Date(mid).toISOString() },
    { start: new Date(mid + 1).toISOString(), end: window.end },
  ];
}

export const halveList = <V>(list: V[]): [V[], V[]] | undefined =>
  list.length > 1 ? [list.slice(0, Math.ceil(list.length / 2)), list.slice(Math.ceil(list.length / 2))] : undefined;

export function dedupeResources<T extends FhirResource>(resources: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const resource of resources) {
    const key = `${resource.resourceType}/${resource.id}`;
    if (resource.id && seen.has(key)) continue;
    if (resource.id) seen.add(key);
    out.push(resource);
  }
  return out;
}

const REPORT_APPOINTMENT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist,cancelled,noshow';

export const REPORT_ATTENDED_APPOINTMENT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist';

// currently async bulk removes the limit on how much the server may SEND, not the limit on the query it has to RUN:
const REPORT_WINDOW_DAYS = 3;
export const REPORT_WINDOW_CONCURRENCY = 4;

/** The range cut into windows of `windowMs` (the last one shorter), keeping the caller's own strings at its two ends; the range itself when it needs no cut. */
export function dateWindows(dateRange: DateRange, windowMs = REPORT_WINDOW_DAYS * DAY_MS): DateRange[] {
  const start = Date.parse(dateRange.start);
  const end = Date.parse(dateRange.end);
  if (!(end > start) || !(windowMs > 0) || windowMs >= end - start) return [dateRange];

  const windows: DateRange[] = [];
  for (let cursor = start; cursor < end; ) {
    const next = Math.min(cursor + windowMs, end);
    windows.push({
      start: cursor === start ? dateRange.start : new Date(cursor).toISOString(),
      end: next === end ? dateRange.end : new Date(next).toISOString(),
    });
    // `date=ge`/`le` include both bounds, so step off the boundary by a millisecond to keep an appointment out of two windows.
    cursor = next + 1;
  }
  return windows;
}

export async function fetchAppointmentReportResources<T extends FhirResource>(
  oystehr: Oystehr,
  opts: {
    dateRange: { start: string; end: string };
    extraParams?: { name: string; value: string }[];
    statuses?: string;
  }
): Promise<T[]> {
  const searchWindow = (window: { start: string; end: string }): Promise<T[]> =>
    searchAsyncBulk<T>(oystehr, 'Appointment', [
      { name: 'date', value: `ge${window.start}` },
      { name: 'date', value: `le${window.end}` },
      { name: 'status', value: opts.statuses ?? REPORT_APPOINTMENT_STATUSES },
      { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
      { name: '_include', value: 'Appointment:patient' },
      { name: '_include', value: 'Appointment:location' },
      { name: '_revinclude', value: 'Encounter:appointment' },
      ...(opts.extraParams ?? []),
    ]);

  const windows = dateWindows(opts.dateRange);
  const out: T[] = [];
  const seen = new Set<string>();
  const startedAt = Date.now();

  for (let i = 0; i < windows.length; i += REPORT_WINDOW_CONCURRENCY) {
    const group = await Promise.all(
      windows
        .slice(i, i + REPORT_WINDOW_CONCURRENCY)
        .map((window) => searchSplittingOnCap(window, searchWindow, halveWindow))
    );
    for (const resources of group) {
      for (const resource of resources) {
        // An included Patient or Location is shared between appointments in different windows.
        const key = `${resource.resourceType}/${resource.id}`;
        if (resource.id && seen.has(key)) continue;
        if (resource.id) seen.add(key);
        out.push(resource);
      }
    }
  }

  out.push(...(await fetchAttendingPractitioners<T>(oystehr, out)));
  console.log(
    `[adhoc] Appointment search: windows=${windows.length} resources=${out.length} ms=${Date.now() - startedAt}`
  );
  return out;
}

// (Temporarily, while async-bulk isn't working as expected): the attending providers used to ride along on the main search as _include:iterate through the
// Encounter, which made every window carry a fourth resource type in full. Only the attending and the
// intake (admitter) participants are ever read — their name and the provider-type extension — so they
// are fetched separately: by id, in batches, three fields each — the same shape as every other heavy
// part of a report.
async function fetchAttendingPractitioners<T extends FhirResource>(oystehr: Oystehr, resources: T[]): Promise<T[]> {
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

const SCOPED_BATCH_SIZE = 100;
const SCOPED_BATCH_CONCURRENCY = 4;

export async function fetchScopedResources<T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  paramName: string,
  values: string[],
  extraParams: { name: string; value: string }[] = [],
  batchSize = SCOPED_BATCH_SIZE
): Promise<T[]> {
  if (values.length === 0) return [];

  const batches: string[][] = [];

  for (let i = 0; i < values.length; i += batchSize) {
    batches.push(values.slice(i, i + batchSize));
  }

  const searchBatch = (batch: string[]): Promise<T[]> =>
    searchAsyncBulk<T>(oystehr, resourceType, [{ name: paramName, value: batch.join(',') }, ...extraParams]);

  const startedAt = Date.now();
  const out: T[] = [];
  for (let i = 0; i < batches.length; i += SCOPED_BATCH_CONCURRENCY) {
    const group = await Promise.all(
      batches.slice(i, i + SCOPED_BATCH_CONCURRENCY).map((batch) => searchSplittingOnCap(batch, searchBatch, halveList))
    );
    for (const resources of group) out.push(...resources);
  }

  console.log(
    `[adhoc] ${resourceType} by ${paramName}: values=${values.length} batches=${batches.length} ` +
      `resources=${out.length} ms=${Date.now() - startedAt}`
  );

  return out;
}

export function resolveEncounterAppointment(
  encounter: Encounter,
  appointmentMap: Map<string, Appointment>,
  encounterById: Map<string, Encounter>
): Appointment | undefined {
  const ownRef = encounter.appointment?.[0]?.reference;
  const own = ownRef ? appointmentMap.get(ownRef) : undefined;

  if (own) return own;

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
