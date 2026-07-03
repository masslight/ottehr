import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Address, Appointment, Encounter, FhirResource, Location, Patient, Practitioner } from 'fhir/r4b';
import {
  getAddressForIndividual,
  getAttendingPractitionerId,
  getEncounterVisitType,
  getInPersonVisitStatus,
  isInPersonAppointment,
  isTelemedAppointment,
  OTTEHR_MODULE,
  SERVICE_CATEGORY_SYSTEM,
} from 'utils';
import { fetchAllPages } from './fhir';

// The full appointment status set (incl. cancelled / no-show) so a report can include or exclude
// them explicitly rather than having them silently pre-filtered.
const REPORT_APPOINTMENT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist,cancelled,noshow';

// The attended/active subset (NO cancelled / no-show) — the set of visits the Recent Patients
// report counts. Used by datasets whose rows carry no per-visit status a report could filter on
// (the Patients dataset's per-patient rollups), so their counts agree with Recent Patients.
export const REPORT_ATTENDED_APPOINTMENT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist';

// The main dataset search, shared by the Encounters / Billing / Patients ad-hoc datasets. Anchored
// on Appointment in the date range, tagged to the in-person + telemed modules, with the bounded
// per-appointment resources (patient, location, encounter, practitioner) riding along so a page
// never approaches the FHIR response-size cap; heavier per-encounter/patient layers are pulled
// afterward via fetchScopedResources. Paginated via fetchAllPages, which also halves the page size
// on a FHIR 4130 response-size-cap error instead of failing the whole report. `extraParams` lets
// a caller add dataset-specific revincludes (e.g. Encounter:part-of, patient-bound clinical layers);
// `statuses` narrows the appointment status set (defaults to the full set incl. cancelled/no-show).
export async function fetchAppointmentReportResources<T extends FhirResource>(
  oystehr: Oystehr,
  opts: {
    dateRange: { start: string; end: string };
    extraParams?: { name: string; value: string }[];
    pageSize?: number;
    statuses?: string;
  }
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 1000;
  const baseSearchParams = [
    { name: 'date', value: `ge${opts.dateRange.start}` },
    { name: 'date', value: `le${opts.dateRange.end}` },
    { name: 'status', value: opts.statuses ?? REPORT_APPOINTMENT_STATUSES },
    { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
    { name: '_include', value: 'Appointment:patient' },
    { name: '_include', value: 'Appointment:location' },
    { name: '_revinclude', value: 'Encounter:appointment' },
    { name: '_include:iterate', value: 'Encounter:participant:Practitioner' },
    ...(opts.extraParams ?? []),
    { name: '_sort', value: 'date' },
  ];

  const out: T[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<T>({
      resourceType: 'Appointment',
      params: [
        ...baseSearchParams,
        { name: '_count', value: count.toString() },
        { name: '_offset', value: offset.toString() },
      ],
    });
    out.push(...(bundle.unbundle() as T[]));
    return bundle;
  }, pageSize);
  return out;
}

// Small OR-lists keep each search well under the per-request timeout (a large encounter OR-list over
// a big table like Observation is slow); chunks run concurrently to keep total wall-clock down.
const ENC_CHUNK = 25;
const CONCURRENCY = 6;

async function searchChunk<T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  paramName: string,
  valueList: string,
  extraParams: { name: string; value: string }[]
): Promise<T[]> {
  const acc: T[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<T>({
      resourceType,
      params: [
        { name: paramName, value: valueList },
        { name: '_count', value: count.toString() },
        { name: '_offset', value: offset.toString() },
        ...extraParams,
      ],
    });
    acc.push(...(bundle.unbundle() as T[]));
    return bundle;
  }, 1000);
  return acc;
}

// Fetch a resource type scoped to a list of values (e.g. encounter references) by splitting the values
// into FHIR OR-list chunks, paginating each chunk, with bounded concurrency. Shared by the ad-hoc
// Encounters and Billing datasets, which both pull per-encounter layer resources this way.
export async function fetchScopedResources<T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  paramName: string,
  values: string[],
  extraParams: { name: string; value: string }[] = []
): Promise<T[]> {
  const chunks: string[] = [];
  for (let i = 0; i < values.length; i += ENC_CHUNK) chunks.push(values.slice(i, i + ENC_CHUNK).join(','));
  const out: T[] = [];
  let failedChunks = 0;
  let firstError: unknown;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const wave = await Promise.allSettled(
      chunks
        .slice(i, i + CONCURRENCY)
        .map((valueList) => searchChunk<T>(oystehr, resourceType, paramName, valueList, extraParams))
    );
    for (const result of wave) {
      if (result.status === 'fulfilled') {
        out.push(...result.value);
      } else {
        failedChunks += 1;
        firstError ??= result.reason;
      }
    }
  }
  if (failedChunks > 0) {
    // Designed degradation (the layer's columns go empty for the affected encounters), but the
    // failure itself must still surface so a persistent search problem doesn't go unnoticed.
    console.warn(
      `fetchScopedResources: ${failedChunks} of ${chunks.length} ${resourceType} chunk searches failed; ` +
        'continuing with partial layer data',
      firstError
    );
    captureException(firstError, {
      extra: { resourceType, paramName, failedChunks, totalChunks: chunks.length },
    });
  }
  return out;
}

// A follow-up encounter may carry no appointment reference of its own — resolve through its partOf
// parent encounter in that case. Shared by the ad-hoc Encounters/Billing/incomplete-encounters reports.
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

// The per-encounter "visit row" prelude shared verbatim by the ad-hoc Encounters and Billing
// datasets: follow-up/parent resolution, patient, location, attending provider name, visit
// type/status, service category, patient address, and the row's start timestamp.
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
  // Some follow-up encounters carry no subject of their own — fall back to the parent's.
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

  // Follow-up rows report their own encounter status — the parent appointment's visit-status
  // machinery doesn't apply to them.
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
  // Follow-up rows carry their OWN dates (the follow-up happened later than the parent visit).
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
