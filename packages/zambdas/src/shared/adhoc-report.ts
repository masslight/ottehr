import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { randomUUID } from 'crypto';
import {
  Address,
  Appointment,
  Bundle,
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

const ASYNC_PAGE_SIZE = 1000;

function readSearchsets<T extends FhirResource>(
  completion: Bundle
): { resources: T[]; matchedIds: string[]; hasNext: boolean } {
  const resources: T[] = [];
  const matchedIds: string[] = [];
  let hasNext = false;
  for (const outer of completion.entry ?? []) {
    // A failed search arrives as an entry with a non-2xx status and NO searchset. Skipping it
    // silently is how a search answering "400 Internal Error" became a successful empty report.
    const status = outer.response?.status;
    if (status && !status.startsWith('2')) {
      const issues = (outer.response?.outcome as OperationOutcome | undefined)?.issue
        ?.map((issue) => issue.details?.text || issue.diagnostics || issue.code)
        .join('; ');
      throw new Error(`FHIR search failed with ${status}${issues ? `: ${issues}` : ''}`);
    }
    const searchset = outer.resource as Bundle | undefined;
    if (!searchset || searchset.resourceType !== 'Bundle' || searchset.type !== 'searchset') continue;
    if (searchset.link?.some((link) => link.relation === 'next')) hasNext = true;
    for (const entry of searchset.entry ?? []) {
      const resource = entry.resource;
      const mode = entry.search?.mode ?? 'match';
      if (!resource || mode === 'outcome') continue;
      resources.push(resource as T);
      // Only matched resources advance the offset; _include ones ride along outside the page count.
      if (mode === 'match' && resource.id) matchedIds.push(resource.id);
    }
  }
  return { resources, matchedIds, hasNext };
}

async function searchAllAsync<T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  params: { name: string; value: string }[]
): Promise<T[]> {
  const out: T[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let progressed = true;
  while (progressed) {
    const pageParams = [
      ...params,
      { name: '_count', value: String(ASYNC_PAGE_SIZE) },
      { name: '_offset', value: String(offset) },
      { name: '_sort', value: '_id' },
    ];
    const handle = await oystehr.fhir.search<T>({ resourceType, params: pageParams }, { mode: 'async-bundle' });
    const status = await oystehr.fhir.waitForAsyncJob<T>(handle.jobId, jobWait());
    if (status.status !== 200 || !('mode' in status) || status.mode !== 'bundle') {
      throw new Error(`Async search for ${resourceType} did not complete in bundle mode`);
    }
    const { resources, matchedIds, hasNext } = readSearchsets<T>(status.bundle as Bundle);
    out.push(...resources);
    const newMatched = matchedIds.filter((id) => !seen.has(id));
    newMatched.forEach((id) => seen.add(id));
    offset += matchedIds.length;
    progressed = hasNext && newMatched.length > 0;
  }
  return out;
}

const REPORT_APPOINTMENT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist,cancelled,noshow';

export const REPORT_ATTENDED_APPOINTMENT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist';

// The main search pulls a whole include graph per appointment, so its size follows the requested
// date range, not a list we control. A five-month range came back empty; a one-month range over the
// same data returned every row. Raise this only with a measurement to back it up.
const REPORT_WINDOW_DAYS = 30;
const REPORT_WINDOW_CONCURRENCY = 4;

// Cuts a range into consecutive windows of at most REPORT_WINDOW_DAYS. A range that already fits,
// or one whose bounds do not parse, is returned unchanged so the search behaves exactly as before.
function reportWindows(dateRange: { start: string; end: string }): { start: string; end: string }[] {
  const start = DateTime.fromISO(dateRange.start);
  const end = DateTime.fromISO(dateRange.end);
  if (!start.isValid || !end.isValid || end <= start) return [dateRange];

  const windows: { start: string; end: string }[] = [];
  let cursor = start;
  while (cursor < end) {
    const next = DateTime.min(cursor.plus({ days: REPORT_WINDOW_DAYS }), end);
    windows.push({ start: cursor.toISO()!, end: next.toISO()! });
    // The next window starts where this one ended; `date=ge`/`le` are inclusive on both sides, so
    // step off the boundary by a millisecond to keep an appointment out of two windows.
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
    searchAllAsync<T>(oystehr, 'Appointment', [
      { name: 'date', value: `ge${window.start}` },
      { name: 'date', value: `le${window.end}` },
      { name: 'status', value: opts.statuses ?? REPORT_APPOINTMENT_STATUSES },
      { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
      { name: '_include', value: 'Appointment:patient' },
      { name: '_include', value: 'Appointment:location' },
      { name: '_revinclude', value: 'Encounter:appointment' },
      { name: '_include:iterate', value: 'Encounter:participant:Practitioner' },
      ...(opts.extraParams ?? []),
    ]);

  const windows = reportWindows(opts.dateRange);
  if (windows.length === 1) return searchWindow(windows[0]);

  const out: T[] = [];
  const seen = new Set<string>();
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
  return out;
}

// One search per batch of scoping values. Measured: a comma list of 1249 encounter references
// (63891 bytes) answers "400 Bad Request / Internal Error", while 100 references answer 200. The
// limit between the two is not documented, so the batch size stays conservative.
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

  // A failed batch used to return an empty list, so the layer came back partly filled and the
  // report looked complete. A report on missing data is worse than a report that says it failed.
  const searchBatch = async (batch: string[]): Promise<T[]> => {
    try {
      return await searchAllAsync<T>(oystehr, resourceType, [
        { name: paramName, value: batch.join(',') },
        ...extraParams,
      ]);
    } catch (error) {
      captureException(error, { extra: { resourceType, paramName, valueCount: batch.length } });
      throw new Error(
        `Could not load ${resourceType} for the report (${batch.length} of ${values.length} by ${paramName}): ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const out: T[] = [];
  for (let i = 0; i < batches.length; i += SCOPED_BATCH_CONCURRENCY) {
    const group = await Promise.all(batches.slice(i, i + SCOPED_BATCH_CONCURRENCY).map(searchBatch));
    for (const resources of group) out.push(...resources);
  }
  console.log(
    `[adhoc] ${resourceType} by ${paramName}: values=${values.length} batches=${batches.length} ` +
      `returned=${out.length}`
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
