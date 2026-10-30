import Oystehr, { FhirSearchParams } from '@oystehr/sdk';
import {
  Appointment,
  Encounter,
  Location,
  Observation,
  Patient,
  Practitioner,
  RelatedPerson,
  Resource,
  Schedule,
} from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
import { isAnnotationFollowupEncounter } from 'utils/lib/fhir/encounter';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { isHeartbeatVitalObservation, isHeightVitalObservation, isWeightVitalObservation } from 'utils/lib/fhir/vitals';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { PastVisitVitals } from 'utils/lib/types/data/appointments/appointments.types';
import {
  parseVitalsObservationsToDTOs,
  VITALS_ENCOUNTER_CHUNK_SIZE,
  vitalsObservationSearchParams,
} from '../../../shared/vitals/parse-vitals-observations';

export type EncounterToAppointmentIdMap = { [appointmentId: string]: Encounter };

export function mapEncountersToAppointmentIds(allResources: Resource[]): EncounterToAppointmentIdMap {
  const result: EncounterToAppointmentIdMap = {};
  allResources.forEach((resource) => {
    if (!(resource.resourceType === 'Encounter' && !isAnnotationFollowupEncounter(resource as Encounter))) return;
    const encounter = resource as Encounter;

    const appointmentReference = encounter?.appointment?.[0].reference || '';
    const appointmentId = removePrefix('Appointment/', appointmentReference);
    if (appointmentId) result[appointmentId] = encounter;
  });
  return result;
}

export async function getFhirResources(
  oystehr: Oystehr,
  patientIDs: string[],
  patientID?: string
): Promise<Resource[]> {
  const fhirSearchParams: FhirSearchParams<Appointment | Encounter | Location | Patient | RelatedPerson | Schedule> = {
    resourceType: 'Appointment',
    params: [
      { name: '_tag', value: [OTTEHR_MODULE.TM, OTTEHR_MODULE.IP].join(',') },
      {
        name: 'patient',
        value: patientID ? `Patient/${patientID}` : patientIDs.join(','),
      },
      {
        name: '_include',
        value: 'Appointment:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'RelatedPerson:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:participant',
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:appointment',
      },
      {
        name: '_include',
        value: 'Appointment:location',
      },
      {
        name: '_include',
        value: 'Appointment:actor',
      },
      {
        name: '_revinclude:iterate',
        value: 'Schedule:actor',
      },
    ],
  };

  const bundle = await oystehr.fhir.search<Appointment | Encounter | Location | Patient | RelatedPerson | Schedule>(
    fhirSearchParams
  );
  return bundle.unbundle();
}

export interface CompletedVisit {
  appointmentId: string;
  encounterId: string;
  date: string;
  timezone?: string;
}

/**
 * Collects heart rate, weight and height for each completed visit. When a vital was recorded more than
 * once in a visit, the most recent reading wins.
 */
export async function getVitalsForCompletedVisits(
  oystehr: Oystehr,
  visits: CompletedVisit[]
): Promise<PastVisitVitals[]> {
  if (!visits.length) return [];

  const bundles = await Promise.all(
    chunkThings(
      visits.map((visit) => visit.encounterId),
      VITALS_ENCOUNTER_CHUNK_SIZE
    ).map((encounterIdChunk) =>
      oystehr.fhir.searchAndGetAllPages<Observation | Practitioner>({
        resourceType: 'Observation',
        params: vitalsObservationSearchParams(encounterIdChunk),
      })
    )
  );
  const resources = bundles.flatMap((bundle) => (bundle.entry ?? []).flatMap((entry) => entry.resource ?? []));
  const observations = resources.filter((resource): resource is Observation => resource.resourceType === 'Observation');
  const practitioners = resources.filter(
    (resource): resource is Practitioner => resource.resourceType === 'Practitioner'
  );

  const encounterIdByObservationId = new Map<string, string>();
  observations.forEach((observation) => {
    const encounterId = removePrefix('Encounter/', observation.encounter?.reference ?? '');
    if (observation.id && encounterId) encounterIdByObservationId.set(observation.id, encounterId);
  });

  const vitalsByEncounterId = new Map<string, PastVisitVitals>(
    visits.map((visit) => [
      visit.encounterId,
      { appointmentId: visit.appointmentId, date: visit.date, timezone: visit.timezone },
    ])
  );

  // Observations arrive sorted by date descending, so the first reading seen for a field is the latest.
  parseVitalsObservationsToDTOs(observations, practitioners, undefined).forEach((dto) => {
    const encounterId = dto.resourceId ? encounterIdByObservationId.get(dto.resourceId) : undefined;
    const visitVitals = encounterId ? vitalsByEncounterId.get(encounterId) : undefined;
    if (!visitVitals) return;

    if (isHeartbeatVitalObservation(dto)) visitVitals.heartRateBpm ??= dto.value;
    if (isWeightVitalObservation(dto) && dto.value !== undefined) visitVitals.weightKg ??= dto.value;
    if (isHeightVitalObservation(dto)) visitVitals.heightCm ??= dto.value;
  });

  return Array.from(vitalsByEncounterId.values())
    .filter(
      (vitals) => vitals.heartRateBpm !== undefined || vitals.weightKg !== undefined || vitals.heightCm !== undefined
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
