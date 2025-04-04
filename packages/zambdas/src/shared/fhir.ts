import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Encounter,
  HealthcareService,
  Location,
  Patient,
  Practitioner,
  PractitionerRole,
  RelatedPerson,
  Schedule,
} from 'fhir/r4b';
import {
  MISCONFIGURED_SCHEDULING_GROUP,
  SCHEDULE_NOT_FOUND_CUSTOM_ERROR,
  SCHEDULE_NOT_FOUND_ERROR,
  ScheduleStrategy,
  scheduleStrategyForHealthcareService,
} from 'utils';

export async function getPatientResource(patientID: string, oystehr: Oystehr): Promise<Patient> {
  const response: Patient = await oystehr.fhir.get({
    resourceType: 'Patient',
    id: patientID ?? '',
  });

  return response;
}

interface ScheduleAndOwner {
  schedule: Schedule;
  owner: Location | Practitioner;
}

interface BaseScheduleResponse {
  owner: HealthcareService | Location | Practitioner;
  schedule: Schedule | undefined;
  groupItems: ScheduleAndOwner[];
}
interface PooledGroupScheduleResponse extends BaseScheduleResponse {
  type: 'group';
  strategy: ScheduleStrategy.poolsAll | ScheduleStrategy.poolsLocations | ScheduleStrategy.poolsProviders;
}

interface NonPooledGroupScheduleResponse extends Omit<BaseScheduleResponse, 'schedule'> {
  schedule: Schedule;
  type: 'group';
  strategy: ScheduleStrategy.owns;
}

interface NonGroupScheduleResponse extends Omit<BaseScheduleResponse, 'schedule'> {
  schedule: Schedule;
  type: 'location' | 'provider';
}

export type GetScheduleResponse =
  | PooledGroupScheduleResponse
  | NonPooledGroupScheduleResponse
  | NonGroupScheduleResponse;
export async function getSchedule(
  oystehr: Oystehr,
  scheduleType: 'location' | 'provider' | 'group',
  slug: string
): Promise<GetScheduleResponse> {
  const fhirType = (() => {
    if (scheduleType === 'location') {
      return 'Location';
    }
    if (scheduleType === 'provider') {
      return 'Practitioner';
    }
    return 'HealthcareService';
  })();
  // get specific schedule resource with all the slots
  const searchParams: SearchParam[] = [
    { name: 'identifier', value: slug },
    { name: '_revinclude', value: `Schedule:actor:${fhirType}` },
  ];

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
      },
      {
        name: '_revinclude:iterate',
        value: 'HealthcareService:location',
      },
      {
        name: '_include:iterate',
        value: 'PractitionerRole:service',
      }
    );
  }

  console.log('searching for resource with search params: ', searchParams);
  const scheduleResources = (
    await oystehr.fhir.search<Location | Practitioner | HealthcareService | Schedule | PractitionerRole>({
      resourceType,
      params: searchParams,
    })
  ).unbundle();

  const scheduleOwner = scheduleResources.find((res) => {
    return res.resourceType === fhirType && res.identifier?.[0]?.value === slug;
  }) as Location | Practitioner | HealthcareService;

  let hsSchedulingStrategy: ScheduleStrategy | undefined;
  if (scheduleOwner?.resourceType === 'HealthcareService') {
    hsSchedulingStrategy = scheduleStrategyForHealthcareService(scheduleOwner as HealthcareService);
  }
  if (hsSchedulingStrategy === undefined) {
    throw MISCONFIGURED_SCHEDULING_GROUP(
      `HealthcareService/${scheduleOwner?.id} needs to be (configured with a scheduling strategy)[todo: link to docs] in order to be used as a schedule provider.`
    );
  }

  if (scheduleOwner === undefined) {
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  if (scheduleResources.length === 0) {
    console.log(`schedule for ${fhirType} with identifier "${slug}" was not found`);
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  const schedule = scheduleResources.find((res) => {
    return res.resourceType === 'Schedule' && res.actor?.[0]?.reference === `${fhirType}/${scheduleOwner.id}`;
  }) as Schedule | undefined;

  //const schedule: Location | Practitioner | HealthcareService = scheduleResources[0];

  if (!schedule?.id && (hsSchedulingStrategy === undefined || hsSchedulingStrategy === ScheduleStrategy.owns)) {
    throw SCHEDULE_NOT_FOUND_CUSTOM_ERROR(
      `No Schedule associated with ${fhirType} with identifier "${slug}" could be found. To cure this, create a Schedule resource referencing this ${fhirType} resource via its "actor" field and give it an extension with the requisite (schedule extension json)[todo: link to docs].`
    );
  }

  const groupItems: ScheduleAndOwner[] = [];
  if (hsSchedulingStrategy === ScheduleStrategy.poolsAll || hsSchedulingStrategy === ScheduleStrategy.poolsProviders) {
    const practitioners: Practitioner[] = [];
    const schedules: Schedule[] = [];

    scheduleResources.forEach((res) => {
      if (res.resourceType === 'Practitioner') {
        practitioners.push(res);
      }
      if (res.resourceType === 'Schedule') {
        schedules.push(res);
      }
    });

    schedules.forEach((sched) => {
      const owner = sched.actor[0]?.reference ?? '';
      const [ownerResourceType, ownerId] = owner.split('/');
      if (ownerResourceType === 'Practitioner' && ownerId) {
        const practitioner = practitioners.find((prac) => {
          prac.id === ownerId;
        });
        if (practitioner) {
          groupItems.push({
            schedule: sched,
            owner: practitioner,
          });
        }
      }
    });
  }

  // todo: there's clearly a generic func to be extracted here...
  if (hsSchedulingStrategy === ScheduleStrategy.poolsAll || hsSchedulingStrategy === ScheduleStrategy.poolsLocations) {
    const locations: Location[] = [];
    const schedules: Schedule[] = [];

    scheduleResources.forEach((res) => {
      if (res.resourceType === 'Location') {
        locations.push(res);
      }
      if (res.resourceType === 'Schedule') {
        schedules.push(res);
      }
    });

    schedules.forEach((sched) => {
      const owner = sched.actor[0]?.reference ?? '';
      const [ownerResourceType, ownerId] = owner.split('/');
      if (ownerResourceType === 'Location' && ownerId) {
        const location = locations.find((prac) => {
          prac.id === ownerId;
        });
        if (location) {
          groupItems.push({
            schedule: sched,
            owner: location,
          });
        }
      }
    });
  }

  if (scheduleType === 'group' && hsSchedulingStrategy === ScheduleStrategy.owns && schedule) {
    return {
      owner: scheduleOwner,
      type: scheduleType,
      strategy: hsSchedulingStrategy,
      schedule,
      groupItems,
    };
  } else if (scheduleType === 'group' && hsSchedulingStrategy !== ScheduleStrategy.owns) {
    return {
      owner: scheduleOwner,
      type: scheduleType,
      strategy: hsSchedulingStrategy,
      schedule,
      groupItems,
    };
  } else if (scheduleType !== 'group') {
    if (schedule === undefined) {
      throw SCHEDULE_NOT_FOUND_CUSTOM_ERROR(
        `No Schedule associated with ${fhirType} with identifier "${slug}" could be found. To cure this, create a Schedule resource referencing this ${fhirType} resource via its "actor" field and give it an extension with the requisite (schedule extension json)[todo: link to docs].`
      );
    }
    return {
      owner: scheduleOwner,
      type: scheduleType,
      schedule,
      groupItems,
    };
  }
  throw new Error('Unexpected state prevented schedule resolution');
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
