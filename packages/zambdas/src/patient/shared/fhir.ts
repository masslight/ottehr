import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, HealthcareService, Location, Patient, Practitioner, RelatedPerson } from 'fhir/r4b';
import { SCHEDULE_NOT_FOUND_ERROR } from 'utils';

export async function getPatientResource(patientID: string, oystehr: Oystehr): Promise<Patient> {
  const response: Patient = await oystehr.fhir.get({
    resourceType: 'Patient',
    id: patientID ?? '',
  });

  return response;
}

export async function getSchedule(
  oystehr: Oystehr,
  scheduleType: 'location' | 'provider' | 'group',
  slug: string
): Promise<{
  schedule: Location | Practitioner | HealthcareService;
  groupItems: (Location | Practitioner | HealthcareService)[];
}> {
  // get specific schedule resource with all the slots
  const searchParams: SearchParam[] = [{ name: 'identifier', value: slug }];

  let resourceType;
  if (scheduleType === 'location') {
    resourceType = 'Location';
  } else if (scheduleType === 'provider') {
    resourceType = 'Practitioner';
  } else if (scheduleType === 'group') {
    resourceType = 'HealthcareService';
  } else {
    throw new Error('resourceType is not expected');
  }

  if (scheduleType === 'group') {
    searchParams.push(
      {
        name: '_include',
        value: 'HealthcareService:location',
      },
      {
        name: '_revinclude',
        value: 'PractitionerRole:service',
      },
      {
        name: '_include:iterate',
        value: 'PractitionerRole:practitioner',
      }
    );
  }

  console.log('searching for resource with search params: ', searchParams);
  const availableSchedule = (
    await oystehr.fhir.search<Location | Practitioner | HealthcareService>({
      resourceType,
      params: searchParams,
    })
  ).unbundle();

  if (availableSchedule.length === 0) {
    console.log(`schedule ${slug} is not found`);
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  const schedule: Location | Practitioner | HealthcareService = availableSchedule[0];

  if (!schedule.id) {
    throw new Error('schedule id is not defined');
  }
  console.log(`successfully retrieved schedule with id ${schedule.id}`);
  return {
    schedule,
    groupItems: availableSchedule.filter(
      (resourceTemp) => resourceTemp.resourceType === 'Location' || resourceTemp.resourceType === 'Practitioner'
    ),
  };
}

export async function updatePatientResource(
  patientId: string,
  patchOperations: Operation[],
  oystehr: Oystehr
): Promise<Patient> {
  try {
    const response: Patient = await oystehr.fhir.patch({
      resourceType: 'Patient',
      id: patientId,
      operations: patchOperations,
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to update Patient: ${JSON.stringify(error)}`);
  }
}

// todo maybe refactor use case to use patchAppt instead and get rid of this and rename above
export async function updateAppointmentTime(
  appointment: Appointment,
  startTime: string,
  endTime: string,
  oystehr: Oystehr
): Promise<Appointment> {
  try {
    const json: Appointment = await oystehr.fhir.patch({
      resourceType: 'Appointment',
      id: appointment.id ?? '',
      operations: [
        {
          op: 'replace',
          path: '/start',
          value: startTime,
        },
        {
          op: 'replace',
          path: '/end',
          value: endTime,
        },
      ],
    });
    return json;
  } catch (error: unknown) {
    throw new Error(`Failed to update Appointment: ${JSON.stringify(error)}`);
  }
}

export async function searchInvitedParticipantResourcesByEncounterId(
  encounterId: string,
  oystehr: Oystehr
): Promise<RelatedPerson[]> {
  const allResources = (
    await oystehr.fhir.search<Encounter | RelatedPerson>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:participant',
        },
      ],
    })
  ).unbundle();

  const relatedPersons: RelatedPerson[] = allResources.filter(
    (r): r is RelatedPerson => r.resourceType === 'RelatedPerson'
  );
  return relatedPersons.filter((r) => r.relationship?.[0].coding?.[0].code === 'WIT');
}
