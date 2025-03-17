import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  Encounter,
  HealthcareService,
  Location,
  Patient,
  Practitioner,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
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
  const appointmentSearchParams = {
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
    ],
  };

  const participantSearchParams = { name: '_count', value: '1000' };

  const [appointmentBundle, healthcareServiceBundle, practitionerBundle] = await Promise.all([
    oystehr.fhir.search<Appointment | Encounter | Location | Patient | RelatedPerson>(appointmentSearchParams),
    oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
      params: [participantSearchParams],
    }),
    oystehr.fhir.search<Practitioner>({
      resourceType: 'Practitioner',
      params: [participantSearchParams],
    }),
  ]);

  return [...appointmentBundle.unbundle(), ...healthcareServiceBundle.unbundle(), ...practitionerBundle.unbundle()];
}
