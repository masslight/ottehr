import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { Bundle, Encounter, FhirResource } from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
import { createFindResourceRequestById, parseSearchsetEntry } from '../chart-data/search-requests';
import { patientIdFromReference } from '../helpers';

// A FHIR batch runs its entries one after another on the server, so one batch of N searches costs roughly
// the sum of all N. Spreading them over concurrent batches turns that sum into a max.
export const CHART_BATCH_TARGET_CONCURRENCY = 6;
export const CHART_BATCH_MIN_SIZE = 3;

export interface OwnedRequest<Owner extends string> {
  owner: Owner;
  request: BatchInputGetRequest;
}

export interface FetchedChartResources<Owner extends string> {
  encounter: Encounter;
  patientId: string;
  /** The resources each owner's searches returned, in search order. */
  byOwner: Record<Owner, FhirResource[]>;
}

const ENCOUNTER_OWNER = '__encounter__';

/**
 * Runs the Encounter read plus every owner's searches in one wave of concurrent batches and hands each
 * owner back exactly the resources its own searches returned. The Encounter must exist and must have a
 * Patient subject; everything downstream keys off that.
 */
export async function fetchChartResources<Owner extends string>(
  oystehr: Oystehr,
  encounterId: string,
  requests: OwnedRequest<Owner>[],
  owners: readonly Owner[]
): Promise<FetchedChartResources<Owner>> {
  const all: OwnedRequest<Owner | typeof ENCOUNTER_OWNER>[] = [
    { owner: ENCOUNTER_OWNER, request: createFindResourceRequestById(encounterId, 'Encounter') },
    ...requests,
  ];
  const groups = chunkThings(
    all,
    Math.max(CHART_BATCH_MIN_SIZE, Math.ceil(all.length / CHART_BATCH_TARGET_CONCURRENCY))
  );

  const responses = await Promise.all(
    groups.map((group) =>
      oystehr.fhir.batch<FhirResource>({ requests: group.map((owned) => owned.request) }).catch((error) => {
        console.log('Error fetching chart resources...', error, JSON.stringify(error));
        throw new Error(`Unable to retrieve chart data for encounter with ID ${encounterId}`);
      })
    )
  );

  const byOwner = Object.fromEntries(owners.map((owner) => [owner, []])) as unknown as Record<Owner, FhirResource[]>;
  let encounter: Encounter | undefined;

  groups.forEach((group, groupIndex) => {
    const entries = (responses[groupIndex] as Bundle<FhirResource>).entry ?? [];
    group.forEach((owned, entryIndex) => {
      const resources = parseSearchsetEntry(entries[entryIndex]);
      if (owned.owner === ENCOUNTER_OWNER) {
        encounter = resources.find((resource): resource is Encounter => resource.resourceType === 'Encounter');
      } else {
        byOwner[owned.owner as Owner].push(...resources);
      }
    });
  });

  if (encounter === undefined) throw new Error(`Encounter with ID ${encounterId} must exist... `);
  const patientId = patientIdFromReference(encounter.subject?.reference);
  if (patientId === undefined) throw new Error(`Encounter  ${encounterId} must be associated with a patient... `);

  return { encounter, patientId, byOwner };
}

/** How many appointments the encounter's patient has; more than one means they have been seen before. */
export async function fetchPatientAppointmentCount(oystehr: Oystehr, encounterId: string): Promise<number> {
  try {
    const result = await oystehr.fhir.batch<FhirResource>({
      requests: [
        {
          method: 'GET',
          url: `/Appointment?patient:Patient._has:Encounter:subject:_id=${encounterId}&_summary=count`,
        },
      ],
    });
    return (result.entry?.[0]?.resource as Bundle<FhirResource> | undefined)?.total ?? 0;
  } catch (error) {
    console.log('Error fetching appointment count for patient...', error);
    return 0;
  }
}
