import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource } from 'fhir/r4b';
import { fetchAllPages } from '../../shared/fhir';

const ENCOUNTER_SCAN_PAGE_SIZE = 100;

export interface PatientEncounterSearchOptions {
  // follow-up encounters carry no appointment reference; most callers only want the visits
  includeEncountersWithoutAppointment?: boolean;
  // also bring back what getScheduleOwnerFromAppointmentOrEncounter picks the schedule owner from:
  // each appointment's actors, and its slot's schedule with that schedule's actor
  includeScheduleOwnerCandidates?: boolean;
}

export interface PatientEncountersAndAppointments {
  encounters: Encounter[];
  appointments: Appointment[];
  // every other included resource (actors, slots, schedules), keyed by "ResourceType/id";
  // only filled with includeScheduleOwnerCandidates
  relatedResourcesByReference: Map<string, FhirResource>;
}

export function encounterAndAppointmentSearchParams(
  patientId: string,
  options: PatientEncounterSearchOptions = {}
): { name: string; value: string }[] {
  return [
    { name: 'subject', value: `Patient/${patientId}` },
    { name: '_include', value: 'Encounter:appointment' },
    ...(options.includeScheduleOwnerCandidates
      ? [
          { name: '_include:iterate', value: 'Appointment:actor' },
          { name: '_include:iterate', value: 'Appointment:slot' },
          { name: '_include:iterate', value: 'Slot:schedule' },
          { name: '_include:iterate', value: 'Schedule:actor' },
        ]
      : []),
    ...(options.includeEncountersWithoutAppointment ? [] : [{ name: 'appointment:missing', value: 'false' }]),
  ];
}

export function splitEncountersAndAppointments(
  resources: FhirResource[],
  patientId: string
): PatientEncountersAndAppointments {
  const encounters: Encounter[] = [];
  const appointments: Appointment[] = [];
  const relatedResourcesByReference = new Map<string, FhirResource>();
  for (const resource of resources) {
    if (resource.resourceType === 'Encounter') encounters.push(resource);
    else if (resource.resourceType === 'Appointment') appointments.push(resource);
    else if (resource.id) relatedResourcesByReference.set(`${resource.resourceType}/${resource.id}`, resource);
  }
  console.log(`Found ${encounters.length} encounters for patient ${patientId}`);
  return { encounters, appointments, relatedResourcesByReference };
}

// Pages through every encounter of the patient, with the appointments they reference.
export async function getAllFhirEncountersAndAppointmentsForPatient(
  oystehr: Oystehr,
  patientId: string,
  options: PatientEncounterSearchOptions = {}
): Promise<PatientEncountersAndAppointments> {
  const resources: FhirResource[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<FhirResource>({
      resourceType: 'Encounter',
      params: [
        ...encounterAndAppointmentSearchParams(patientId, options),
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    resources.push(...bundle.unbundle());
    return bundle;
  }, ENCOUNTER_SCAN_PAGE_SIZE);
  return splitEncountersAndAppointments(resources, patientId);
}
