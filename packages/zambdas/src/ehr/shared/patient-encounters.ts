import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource } from 'fhir/r4b';
import { fetchAllPages } from '../../shared/fhir';

const ENCOUNTER_SCAN_PAGE_SIZE = 100;

export interface PatientEncounterSearchOptions {
  // follow-up encounters carry no appointment reference; most callers only want the visits
  includeEncountersWithoutAppointment?: boolean;
  // also bring back each appointment's participants (locations, practitioners, ...)
  includeAppointmentActors?: boolean;
}

export interface PatientEncountersAndAppointments {
  encounters: Encounter[];
  appointments: Appointment[];
  // the appointments' participants, keyed by "ResourceType/id"; only filled with includeAppointmentActors
  appointmentActorsByReference: Map<string, FhirResource>;
}

export function encounterAndAppointmentSearchParams(
  patientId: string,
  options: PatientEncounterSearchOptions = {}
): { name: string; value: string }[] {
  return [
    { name: 'subject', value: `Patient/${patientId}` },
    { name: '_include', value: 'Encounter:appointment' },
    ...(options.includeAppointmentActors ? [{ name: '_include:iterate', value: 'Appointment:actor' }] : []),
    ...(options.includeEncountersWithoutAppointment ? [] : [{ name: 'appointment:missing', value: 'false' }]),
  ];
}

export function splitEncountersAndAppointments(
  resources: FhirResource[],
  patientId: string
): PatientEncountersAndAppointments {
  const encounters: Encounter[] = [];
  const appointments: Appointment[] = [];
  const appointmentActorsByReference = new Map<string, FhirResource>();
  for (const resource of resources) {
    if (resource.resourceType === 'Encounter') encounters.push(resource);
    else if (resource.resourceType === 'Appointment') appointments.push(resource);
    else if (resource.id) appointmentActorsByReference.set(`${resource.resourceType}/${resource.id}`, resource);
  }
  console.log(`Found ${encounters.length} encounters for patient ${patientId}`);
  return { encounters, appointments, appointmentActorsByReference };
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
