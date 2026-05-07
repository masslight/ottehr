import Oystehr, {
  BatchInputDeleteRequest,
  BatchInputPatchRequest,
  BatchInputPostRequest,
  SearchParam,
} from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Bundle,
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
  checkResourceHasSlug,
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
  // 'provider' resolves to a PractitionerRole — the PR-aware equivalent of the
  // legacy "this provider's booking link." A PR pins (Practitioner, Location,
  // categories) so the share-link is meaningfully scoped. Practitioner-actored
  // Schedules are no longer produced by this codebase.
  const fhirType = (() => {
    if (scheduleType === 'location') {
      return 'Location';
    }
    if (scheduleType === 'provider') {
      return 'PractitionerRole';
    }
    return 'HealthcareService';
  })();
  const searchParams: SearchParam[] = [
    { name: 'identifier', value: `${SLUG_SYSTEM}|${slug}` },
    { name: '_revinclude', value: `Schedule:actor:${fhirType}` },
  ];

  let resourceType;
  if (scheduleType === 'location') {
    resourceType = 'Location';
  } else if (scheduleType === 'provider') {
    resourceType = 'PractitionerRole';
  } else if (scheduleType === 'group') {
    resourceType = 'HealthcareService';
  } else {
    throw new Error('resourceType is not expected');
  }

  if (scheduleType === 'provider') {
    // Pull in the PR's Practitioner + Location so downstream code has the
    // resources to render a meaningful name + address without a follow-up
    // FHIR roundtrip.
    searchParams.push(
      { name: '_include', value: 'PractitionerRole:practitioner' },
      { name: '_include', value: 'PractitionerRole:location' }
    );
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
      { name: '_revinclude:iterate', value: 'Schedule:actor:Location' },
      // PractitionerRole-as-schedule-actor support: pull in any Schedule whose
      // actor is one of the PractitionerRoles we included above. This enables
      // the newer model where a Practitioner's schedule-at-a-location lives on
      // a PractitionerRole rather than on the Practitioner directly.
      { name: '_revinclude:iterate', value: 'Schedule:actor:PractitionerRole' }
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
    return res.resourceType === fhirType && checkResourceHasSlug(res, slug);
  }) as Location | Practitioner | HealthcareService | PractitionerRole;

  let hsSchedulingStrategy: ScheduleStrategy | undefined;
  if (scheduleOwner?.resourceType === 'HealthcareService') {
    hsSchedulingStrategy = scheduleStrategyForHealthcareService(scheduleOwner as HealthcareService);
  }
  if (hsSchedulingStrategy === undefined && scheduleOwner?.resourceType === 'HealthcareService') {
    throw MISCONFIGURED_SCHEDULING_GROUP(
      `HealthcareService/${scheduleOwner?.id} needs to be configured with a scheduling strategy in order to be used as a schedule provider.`
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
      `No Schedule associated with ${fhirType} with identifier "${slug}" could be found. To cure this, create a Schedule resource referencing this ${fhirType} resource via its "actor" field and give it an extension with the requisite schedule extension json.`
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

    // Also collect PractitionerRoles fetched above so we can match them when a
    // Schedule's actor is a PractitionerRole rather than a raw Practitioner.
    const practitionerRoles: PractitionerRole[] = [];
    scheduleResources.forEach((res) => {
      if (res.resourceType === 'PractitionerRole') practitionerRoles.push(res);
    });

    schedules.forEach((scheduleObj) => {
      const owner = scheduleObj.actor[0]?.reference ?? '';
      const [ownerResourceType, ownerId] = owner.split('/');
      if (ownerResourceType === 'Practitioner' && ownerId) {
        const practitioner = practitioners.find((practitionerObj) => {
          return practitionerObj.id === ownerId;
        });
        if (practitioner) {
          scheduleList.push({
            schedule: scheduleObj,
            owner: practitioner,
          });
        }
      } else if (ownerResourceType === 'PractitionerRole' && ownerId) {
        const role = practitionerRoles.find((r) => r.id === ownerId);
        // Only include PractitionerRole schedules whose role references this
        // group via .healthcareService[] — this is what makes the role a
        // member of the pool.
        const isMember = role?.healthcareService?.some(
          (ref) => ref.reference === `HealthcareService/${scheduleOwner.id}`
        );
        if (role && isMember) {
          scheduleList.push({
            schedule: scheduleObj,
            owner: role,
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

    schedules.forEach((scheduleObj) => {
      const owner = scheduleObj.actor[0]?.reference ?? '';
      const [ownerResourceType, ownerId] = owner.split('/');
      if (ownerResourceType === 'Location' && ownerId) {
        const location = locations.find((loc) => {
          return loc.id === ownerId;
        });
        if (location) {
          scheduleList.push({
            schedule: scheduleObj,
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
    scheduleList.push(...matchingSchedules.map((scheduleObj) => ({ schedule: scheduleObj, owner: scheduleOwner })));
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

export async function fetchAllPages(
  fetchPage: (offset: number, count: number) => Promise<Bundle>,
  initialPageSize: number
): Promise<void> {
  let offset = 0;
  let pageSize = initialPageSize;
  let hasMorePages = true;
  do {
    let bundle;
    let pageFetched = false;
    while (!pageFetched && pageSize > 0) {
      try {
        bundle = await fetchPage(offset, pageSize);
        pageFetched = true;
      } catch (error: unknown) {
        console.log(`Error fetching page: ${error}`, JSON.stringify(error));
        if (error instanceof Oystehr.OystehrSdkError && (error.code === 4130 || (error.code as any) === '4130')) {
          pageSize = Math.floor(pageSize / 2);
        } else {
          throw error;
        }
      }
    }
    if (pageSize === 0) {
      throw new Error('Failed to fetch resources');
    }
    hasMorePages = bundle?.link?.find((link) => link.relation === 'next') != null;
    offset += pageSize;

    // Safety check
    if (offset > 100000) {
      console.warn('Reached maximum pagination limit (100000 items). Stopping search.');
      break;
    }
  } while (hasMorePages);
}
