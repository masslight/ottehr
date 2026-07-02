import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource } from 'fhir/r4b';
import { OTTEHR_MODULE } from 'utils';

// The full appointment status set (incl. cancelled / no-show) so a report can include or exclude
// them explicitly rather than having them silently pre-filtered.
const REPORT_APPOINTMENT_STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist,cancelled,noshow';

// The main dataset search, shared by the Encounters / Billing / Patients ad-hoc datasets. Anchored
// on Appointment in the date range, tagged to the in-person + telemed modules, with the bounded
// per-appointment resources (patient, location, encounter, practitioner) riding along so a page
// never approaches the FHIR response-size cap; heavier per-encounter/patient layers are pulled
// afterward via fetchScopedResources. Paginated by offset with a hard page cap. `extraParams` lets
// a caller add dataset-specific revincludes (e.g. Encounter:part-of, patient-bound clinical layers).
export async function fetchAppointmentReportResources<T extends FhirResource>(
  oystehr: Oystehr,
  opts: {
    dateRange: { start: string; end: string };
    extraParams?: { name: string; value: string }[];
    pageSize?: number;
    maxPages?: number;
  }
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 1000;
  const maxPages = opts.maxPages ?? 100;
  const baseSearchParams = [
    { name: 'date', value: `ge${opts.dateRange.start}` },
    { name: 'date', value: `le${opts.dateRange.end}` },
    { name: 'status', value: REPORT_APPOINTMENT_STATUSES },
    { name: '_tag', value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}` },
    { name: '_include', value: 'Appointment:patient' },
    { name: '_include', value: 'Appointment:location' },
    { name: '_revinclude', value: 'Encounter:appointment' },
    { name: '_include:iterate', value: 'Encounter:participant:Practitioner' },
    ...(opts.extraParams ?? []),
    { name: '_sort', value: 'date' },
    { name: '_count', value: pageSize.toString() },
  ];

  const out: T[] = [];
  let offset = 0;
  let pageCount = 0;
  for (;;) {
    const bundle = await oystehr.fhir.search<T>({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });
    out.push(...(bundle.unbundle() as T[]));
    pageCount += 1;
    if (!bundle.link?.find((l) => l.relation === 'next')) break;
    if (pageCount >= maxPages) {
      console.warn(`fetchAppointmentReportResources: hit ${maxPages}-page cap, stopping.`);
      break;
    }
    offset += pageSize;
  }
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
  let pageOffset = 0;
  for (;;) {
    const bundle = await oystehr.fhir.search<T>({
      resourceType,
      params: [
        { name: paramName, value: valueList },
        { name: '_count', value: '1000' },
        { name: '_offset', value: pageOffset.toString() },
        ...extraParams,
      ],
    });
    acc.push(...(bundle.unbundle() as T[]));
    if (!bundle.link?.find((l) => l.relation === 'next')) break;
    pageOffset += 1000;
  }
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
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const wave = await Promise.all(
      chunks
        .slice(i, i + CONCURRENCY)
        .map((valueList) => searchChunk<T>(oystehr, resourceType, paramName, valueList, extraParams))
    );
    for (const part of wave) out.push(...part);
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
