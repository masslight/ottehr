import { FhirClient } from '@zapehr/sdk';
import { Encounter, Resource } from 'fhir/r4';
import { getVideoRoomResourceExtension, removePrefix } from '../../shared/appointment/helpers';
import { OTTEHR_MODULE } from 'ottehr-utils';

export type EncounterToAppointmentIdMap = { [appointmentId: string]: Encounter };

export function filterTelemedVideoEncounters(allResources: Resource[]): EncounterToAppointmentIdMap {
  const result: EncounterToAppointmentIdMap = {};
  allResources.forEach((resource) => {
    if (!(resource.resourceType === 'Encounter' && getVideoRoomResourceExtension(resource))) return;
    const encounter = resource as Encounter;

    const appointmentReference = encounter?.appointment?.[0].reference || '';
    const appointmentId = removePrefix('Appointment/', appointmentReference);
    if (appointmentId) result[appointmentId] = encounter;
  });
  return result;
}

export async function getFhirResources(
  fhirClient: FhirClient,
  patientIDs: string[],
  patientID?: string,
): Promise<Resource[]> {
  if (!patientID && patientIDs.length === 0) {
    console.log('No patient ID is provided');
    return [];
  }

  const fhirSearchParams = {
    resourceType: 'Appointment',
    searchParams: [
      { name: '_tag', value: OTTEHR_MODULE.TM },
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
      // {
      //   name: '_include',
      //   value: 'Appointment:location',
      // },
      // {
      //   name: '_revinclude:iterate',
      //   value: 'DocumentReference:patient',
      // },
      // {
      //   name: '_revinclude:iterate',
      //   value: 'QuestionnaireResponse:encounter',
      // },
    ],
  };
  return await fhirClient?.searchResources(fhirSearchParams);
}
