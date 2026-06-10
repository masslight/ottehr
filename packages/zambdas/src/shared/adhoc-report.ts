import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource } from 'fhir/r4b';

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
