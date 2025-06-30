import Oystehr, { FhirSearchParams } from '@oystehr/sdk';
import { Appointment, Encounter, Location, Patient, RelatedPerson, Resource, Schedule } from 'fhir/r4b';
import { OTTEHR_MODULE, removePrefix } from 'utils';

export type EncounterToAppointmentIdMap = { [appointmentId: string]: Encounter };

export function mapEncountersToAppointmentIds(allResources: Resource[]): EncounterToAppointmentIdMap {
  const result: EncounterToAppointmentIdMap = {};
  allResources.forEach((resource) => {
    if (!(resource.resourceType === 'Encounter')) return;
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
