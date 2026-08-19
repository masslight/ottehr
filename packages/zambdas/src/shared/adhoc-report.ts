import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { randomUUID } from 'crypto';
import { Address, Appointment, Bundle, Encounter, FhirResource, Location, Patient, Practitioner } from 'fhir/r4b';
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

export async function fetchAppointmentReportResources<T extends FhirResource>(
  oystehr: Oystehr,
  opts: {
    dateRange: { start: string; end: string };
    extraParams?: { name: string; value: string }[];
    statuses?: string;
  }
): Promise<T[]> {
  return searchAllAsync<T>(oystehr, 'Appointment', [
    { name: 'date', value: `ge${opts.dateRange.start}` },
    { name: 'date', value: `le${opts.dateRange.end}` },
    { name: 'status', value: opts.statuses ?? REPORT_APPOINTMENT_STATUSES },
    { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
    { name: '_include', value: 'Appointment:patient' },
    { name: '_include', value: 'Appointment:location' },
    { name: '_revinclude', value: 'Encounter:appointment' },
    { name: '_include:iterate', value: 'Encounter:participant:Practitioner' },
    ...(opts.extraParams ?? []),
  ]);
}

// One search per batch of scoping values. Measured: a single comma list of encounter references
// comes back as an EMPTY searchset with no error, while batches of 100 return the data.
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

  const searchBatch = async (batch: string[]): Promise<T[]> => {
    try {
      return await searchAllAsync<T>(oystehr, resourceType, [
        { name: paramName, value: batch.join(',') },
        ...extraParams,
      ]);
    } catch (error) {
      console.warn(
        `fetchScopedResources: ${resourceType} async search failed; continuing with partial layer data`,
        error
      );
      captureException(error, { extra: { resourceType, paramName, valueCount: batch.length } });
      return [];
    }
  };

  const out: T[] = [];
  for (let i = 0; i < batches.length; i += SCOPED_BATCH_CONCURRENCY) {
    const group = await Promise.all(batches.slice(i, i + SCOPED_BATCH_CONCURRENCY).map(searchBatch));
    for (const resources of group) out.push(...resources);
  }
  console.log(
    `[adhoc-scoped] ${resourceType} by ${paramName}: values=${values.length} batches=${batches.length} ` +
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
