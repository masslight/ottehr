import Oystehr, {
  BatchInputDeleteRequest,
  BatchInputPatchRequest,
  BatchInputPostRequest,
  SearchParam,
} from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Encounter,
  HealthcareService,
  Location,
  Patient,
  Practitioner,
  PractitionerRole,
  Reference,
  RelatedPerson,
  Schedule,
  Slot,
} from 'fhir/r4b';
import { uuid } from 'short-uuid';
import {
  BookableScheduleData,
  isValidUUID,
  MISCONFIGURED_SCHEDULING_GROUP,
  SCHEDULE_NOT_FOUND_CUSTOM_ERROR,
  SCHEDULE_NOT_FOUND_ERROR,
  ScheduleOwnerFhirResource,
  ScheduleStrategy,
  scheduleStrategyForHealthcareService,
  SLUG_SYSTEM,
  unbundleBatchPostOutput,
} from 'utils';

export async function getPatientResource(patientID: string, oystehr: Oystehr): Promise<Patient> {
  const response: Patient = await oystehr.fhir.get({
    resourceType: 'Patient',
    id: patientID ?? '',
  });

  return response;
}

interface GetScheduleResponse extends BookableScheduleData {
  rootScheduleOwner: ScheduleOwnerFhirResource;
}

export async function getSchedules(
  oystehr: Oystehr,
  scheduleType: 'location' | 'provider' | 'group',
  slug: string
): Promise<GetScheduleResponse> {
  //todo: change return type to include the owner outside the scheduleList
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
    { name: 'identifier', value: `${SLUG_SYSTEM}|${slug}` },
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
      },
      { name: '_revinclude:iterate', value: 'Schedule:actor:Practitioner' },
      { name: '_revinclude:iterate', value: 'Schedule:actor:Location' }
    );
  }

  console.log('searching for resource with search params: ', searchParams);
  const scheduleResources = (
    await oystehr.fhir.search<Location | Practitioner | HealthcareService | Schedule | PractitionerRole>({
      resourceType: resourceType as 'Location' | 'Practitioner' | 'HealthcareService' | 'Schedule' | 'PractitionerRole',
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
  if (hsSchedulingStrategy === undefined && scheduleOwner?.resourceType === 'HealthcareService') {
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

  const practitioners: Practitioner[] = [];
  const schedules: Schedule[] = [];
  const locations: Location[] = [];

  scheduleResources.forEach((res) => {
    if (res.resourceType === 'Practitioner') {
      practitioners.push(res);
    }
    if (res.resourceType === 'Schedule') {
      schedules.push(res);
    }
    if (res.resourceType === 'Location') {
      locations.push(res);
    }
  });

  const scheduleList: BookableScheduleData['scheduleList'] = [];
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
          return prac.id === ownerId;
        });
        if (practitioner) {
          scheduleList.push({
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
        const location = locations.find((loc) => {
          return loc.id === ownerId;
        });
        if (location) {
          scheduleList.push({
            schedule: sched,
            owner: location,
          });
        }
      }
    });
  }

  if (hsSchedulingStrategy === undefined || hsSchedulingStrategy === ScheduleStrategy.owns) {
    const matchingSchedules = schedules.filter((res) => {
      return res.actor?.[0]?.reference === `${scheduleOwner.resourceType}/${scheduleOwner.id}`;
    });
    scheduleList.push(...matchingSchedules.map((sched) => ({ schedule: sched, owner: scheduleOwner })));
  }

  return {
    metadata: {
      type: scheduleType,
      strategy: hsSchedulingStrategy,
    },
    scheduleList,
    rootScheduleOwner: scheduleOwner, // this probable isn't needed. just the ref can go in metadata
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
  oystehr: Oystehr,
  slot?: Slot
): Promise<Appointment> {
  try {
    const currentSlotRef = appointment?.slot?.[0]?.reference;
    let newSlotReference: Reference | undefined;
    const patchSlotRequests: BatchInputPatchRequest<Slot>[] = [];
    const deleteSlotRequests: BatchInputDeleteRequest[] = [];
    const postSlotRequests: BatchInputPostRequest<Slot>[] = [];
    if (slot && `Slot/${slot.id}` !== currentSlotRef) {
      // we need to update the Appointment with the passed in Slot
      if (isValidUUID(slot?.id ?? '') && slot?.meta !== undefined) {
        // assume slot already persisted
        newSlotReference = {
          reference: `Slot/${slot.id}`,
        };
        patchSlotRequests.push({
          method: 'PATCH',
          url: `Slot/${slot.id}`,
          operations: [
            {
              op: 'replace',
              path: '/status',
              value: 'busy',
            },
          ],
        });
        const currenSlotId = currentSlotRef?.split('/')[1];
        if (currenSlotId) {
          deleteSlotRequests.push({
            method: 'DELETE',
            url: `Slot/${currentSlotRef?.split('/')[1]}`,
          });
        }
      } else if (slot) {
        postSlotRequests.push({
          method: 'POST',
          url: '/Slot',
          resource: {
            ...slot,
            resourceType: 'Slot',
            id: undefined,
            status: 'busy',
          },
          fullUrl: `urn:uuid:${uuid()}`,
        });
        newSlotReference = {
          reference: postSlotRequests[0].fullUrl,
        };
      }
    }

    const slotRefOps: Operation[] = [];
    if (newSlotReference) {
      slotRefOps.push({
        op: appointment.slot === undefined ? 'add' : 'replace',
        path: '/slot',
        value: [newSlotReference],
      });
    }

    const patchRequest: BatchInputPatchRequest<Appointment> = {
      method: 'PATCH',
      url: `Appointment/${appointment.id}`,
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
        ...slotRefOps,
      ],
    };
    const json = await oystehr.fhir.transaction<Appointment | Slot>({
      requests: [...postSlotRequests, patchRequest, ...patchSlotRequests, ...deleteSlotRequests],
    });
    const flattened = unbundleBatchPostOutput<Appointment | Slot>(json);
    const apt = flattened.find((res): res is Appointment => res.resourceType === 'Appointment');
    if (!apt) {
      throw new Error('Appointment not returned in bundle');
    }
    return apt;
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
