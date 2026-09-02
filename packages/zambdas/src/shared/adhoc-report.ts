import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
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
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BUCKET_NAMES, SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { getEncounterVisitType } from 'utils/lib/fhir/encounter';
import { isInPersonAppointment, isTelemedAppointment, OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { getAddressForIndividual } from 'utils/lib/fhir/patient';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { getInPersonVisitStatus } from 'utils/lib/utils/visitUtils';
import { createPresignedUrl } from './z3Utils';

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

let reportDeadlineMs = 0;

export function beginReportBudget(): void {
  reportDeadlineMs = Date.now() + REPORT_BUDGET_MS;
}

function jobWait(): { pollIntervalMs: number; timeoutMs: number } {
  if (reportDeadlineMs === 0) return { pollIntervalMs: 2000, timeoutMs: DEFAULT_JOB_TIMEOUT_MS };
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

async function searchAsyncBulk<T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  params: { name: string; value: string }[]
): Promise<T[]> {
  const label = `${resourceType} by ${params.map((p) => p.name).join(',')}`;
  const startedAt = Date.now();
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
    return resources;
  } catch (error) {
    console.error(
      `[adhoc] ${label}: FAILED job=${jobId || 'not started'} ms=${Date.now() - startedAt} ` +
        `code=${(error as { code?: unknown })?.code ?? 'none'} message=${
          error instanceof Error ? error.message : String(error)
        }`
    );

    await logAsyncJobFailure(oystehr, jobId, label);

    captureException(error, { extra: { resourceType, jobId, params } });

    throw new Error(
      `Could not load ${resourceType} for the report (job ${jobId || 'not started'}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

const REPORT_APPOINTMENT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist,cancelled,noshow';

export const REPORT_ATTENDED_APPOINTMENT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist';

// currently async bulk removes the limit on how much the server may SEND, not the limit on the query it has to RUN:
const REPORT_WINDOW_DAYS = 3;
const REPORT_WINDOW_CONCURRENCY = 4;

function reportWindows(dateRange: { start: string; end: string }): { start: string; end: string }[] {
  const start = DateTime.fromISO(dateRange.start);
  const end = DateTime.fromISO(dateRange.end);
  if (!start.isValid || !end.isValid || end <= start) return [dateRange];

  const windows: { start: string; end: string }[] = [];
  let cursor = start;
  while (cursor < end) {
    const next = DateTime.min(cursor.plus({ days: REPORT_WINDOW_DAYS }), end);
    windows.push({ start: cursor.toISO()!, end: next.toISO()! });
    // `date=ge`/`le` include both bounds, so step off the boundary by a millisecond to keep an appointment out of two windows.
    cursor = next.plus({ milliseconds: 1 });
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

  const windows = reportWindows(opts.dateRange);
  const out: T[] = [];
  const seen = new Set<string>();
  const startedAt = Date.now();

  for (let i = 0; i < windows.length; i += REPORT_WINDOW_CONCURRENCY) {
    const group = await Promise.all(windows.slice(i, i + REPORT_WINDOW_CONCURRENCY).map(searchWindow));
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
// Encounter, which made every window carry a fourth resource type in full. Only the attending one is
// ever read, and only its name, so they are fetched separately: by id, in batches, two fields each —
// the same shape as every other heavy part of a report.
async function fetchAttendingPractitioners<T extends FhirResource>(oystehr: Oystehr, resources: T[]): Promise<T[]> {
  const ids = new Set<string>();
  for (const resource of resources) {
    if (resource.resourceType !== 'Encounter') continue;
    const id = getAttendingPractitionerId(resource as Encounter);
    if (id) ids.add(id);
  }
  if (ids.size === 0) return [];
  return fetchScopedResources<T>(oystehr, 'Practitioner', '_id', Array.from(ids), [
    { name: '_elements', value: 'id,name' },
  ]);
}

const SCOPED_BATCH_SIZE = 100;
const SCOPED_BATCH_CONCURRENCY = 4;

export async function fetchScopedResources<T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  paramName: string,
  values: string[],
  extraParams: { name: string; value: string }[] = []
): Promise<T[]> {
  if (values.length === 0) return [];

  const batches: string[][] = [];

  for (let i = 0; i < values.length; i += SCOPED_BATCH_SIZE) {
    batches.push(values.slice(i, i + SCOPED_BATCH_SIZE));
  }

  const searchBatch = (batch: string[]): Promise<T[]> =>
    searchAsyncBulk<T>(oystehr, resourceType, [{ name: paramName, value: batch.join(',') }, ...extraParams]);

  const startedAt = Date.now();
  const out: T[] = [];
  for (let i = 0; i < batches.length; i += SCOPED_BATCH_CONCURRENCY) {
    const group = await Promise.all(batches.slice(i, i + SCOPED_BATCH_CONCURRENCY).map(searchBatch));
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
  const isFollowUpRow = encounterType === 'follow-up' || encounterType === 'scheduled-follow-up';

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
