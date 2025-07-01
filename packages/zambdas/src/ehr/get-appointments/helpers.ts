import Oystehr, { Bundle, SearchParam } from '@oystehr/sdk';
import { Appointment, Encounter, Extension, FhirResource, HealthcareService, Location, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AppointmentParticipants,
  OTTEHR_MODULE,
  PARTICIPANT_TYPE,
  ParticipantInfo,
  ScheduleStrategy,
  scheduleStrategyForHealthcareService,
} from 'utils';

const parseParticipantInfo = (practitioner: Practitioner): ParticipantInfo => ({
  firstName: practitioner.name?.[0]?.given?.[0] ?? '',
  lastName: practitioner.name?.[0]?.family ?? '',
});

export const parseEncounterParticipants = (
  encounter: Encounter,
  participantIdToResourceMap: Record<string, Practitioner>
): AppointmentParticipants => {
  const participants: AppointmentParticipants = {};

  encounter.participant?.forEach((participant) => {
    // Skip if no reference or type
    if (!participant.individual?.reference || !participant.type?.[0]?.coding?.[0]?.code) {
      return;
    }

    const practitioner = participantIdToResourceMap[participant.individual.reference];
    if (!practitioner) return;

    const participantType = participant.type[0].coding[0].code;

    switch (participantType) {
      case PARTICIPANT_TYPE.ADMITTER:
        participants.admitter = parseParticipantInfo(practitioner);
        break;
      case PARTICIPANT_TYPE.ATTENDER:
        participants.attender = parseParticipantInfo(practitioner);
        break;
    }
  });

  return participants;
};

export const mergeResources = <T extends FhirResource>(resources: T[]): T[] => {
  if (!resources.length) return [];

  const uniqueMap = new Map<string, T>();

  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];
    if (resource && resource.id) {
      uniqueMap.set(resource.id, resource);
    }
  }

  return Array.from(uniqueMap.values());
};

export const getMergedResourcesFromBundles = <T extends FhirResource>(bundles: Bundle<T>[]): T[] => {
  const allResources = bundles.flatMap((bundle) => bundle.unbundle());
  return mergeResources(allResources);
};

export const makeResourceCacheKey = ({
  resourceId,
  resourceType,
}: {
  resourceId: string;
  resourceType: 'Location' | 'Practitioner' | 'HealthcareService';
}): string => {
  const time = DateTime.now().setZone('UTC').startOf('day').toISO();
  return `${resourceType}|${resourceId}|${time}`;
};

export const timezoneMap: Map<string, string> = new Map(); // key: Location id | Group id | Provider id, value: timezone

/**
 * Encounters ids for previous day and older are cached, and if that response didn't
 * return any encounters (cache value is a null in that case), we can skip the search for this date
 */
export const encounterIdMap: Map<string, string | null> = new Map(); // key: cache key, value: encounter ids

export const getTimezone = async ({
  oystehr,
  resourceType,
  resourceId,
}: {
  oystehr: Oystehr;
  resourceType: 'Location' | 'Practitioner' | 'HealthcareService';
  resourceId: string;
}): Promise<string | undefined> => {
  let timezone: string | undefined;

  if (!timezoneMap.has(resourceId)) {
    try {
      const resource = await oystehr.fhir.get<Location | Practitioner | HealthcareService>({
        resourceType,
        id: resourceId,
      });
      timezone = resource?.extension?.find(
        (extensionTemp: Extension) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
      )?.valueString;

      if (timezone) {
        timezoneMap.set(resourceId, timezone);
        console.log(`timezone found for ${resourceId} and added to timezoneMap`, timezone);
      } else {
        console.error(`timezone not set for ${resourceId}`);
      }
    } catch (e) {
      console.log('error getting location', JSON.stringify(e));
      throw new Error('location is not found');
    }
  }
  return timezoneMap.get(resourceId);
};

interface AppointmentQueryInput {
  resourceType: 'Appointment';
  params: SearchParam[];
  group?: HealthcareService;
}

export const getAppointmentQueryInput = async (input: {
  oystehr: Oystehr;
  resourceId: string;
  resourceType: 'Location' | 'Practitioner' | 'HealthcareService';
  searchDate: string;
}): Promise<AppointmentQueryInput> => {
  const { oystehr, resourceId, resourceType, searchDate } = input;
  const timezone = await getTimezone({
    oystehr,
    resourceType,
    resourceId,
  });

  const searchDateInTargetTimezone = DateTime.fromISO(searchDate, { zone: timezone });
  const startDay = searchDateInTargetTimezone.startOf('day').toUTC().toISO();
  const endDay = searchDateInTargetTimezone.endOf('day').toUTC().toISO();

  const { actorParams, healthcareService } = await getActorParamsForAppointmentQueryInput(input);

  return {
    resourceType: 'Appointment',
    params: [
      {
        name: 'date',
        value: `ge${startDay}`,
      },
      {
        name: 'date',
        value: `le${endDay}`,
      },
      {
        name: 'date:missing',
        value: 'false',
      },
      {
        name: '_sort',
        value: 'date',
      },
      { name: '_count', value: '1000' },
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
        value: 'Person:link',
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:participant',
      },
      {
        name: '_include',
        value: 'Appointment:location',
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:appointment',
      },
      { name: '_revinclude:iterate', value: 'DocumentReference:patient' },
      { name: '_revinclude:iterate', value: 'QuestionnaireResponse:encounter' },
      { name: '_include', value: 'Appointment:actor' },
      ...actorParams,
    ],
    group: healthcareService,
  };
};

export const getActiveAppointmentsBeforeTodayQueryInput = async (input: {
  oystehr: Oystehr;
  resourceId: string;
  resourceType: 'Location' | 'Practitioner' | 'HealthcareService';
}): Promise<AppointmentQueryInput> => {
  const { actorParams, healthcareService } = await getActorParamsForAppointmentQueryInput(input);
  return {
    resourceType: 'Appointment',
    params: [
      {
        name: 'date:missing',
        value: 'false',
      },
      {
        name: 'actor:missing',
        value: 'false',
      },
      {
        name: '_include',
        value: 'Appointment:patient',
      },
      {
        name: '_sort',
        value: 'date',
      },
      { name: '_count', value: '1000' },
      ...actorParams,
    ],
    group: healthcareService,
  };
};

const getActorParamsForAppointmentQueryInput = async ({
  oystehr,
  resourceId,
  resourceType,
}: {
  oystehr: Oystehr;
  resourceId: string;
  resourceType: 'Location' | 'Practitioner' | 'HealthcareService';
}): Promise<{ actorParams: { name: string; value: string }[]; healthcareService: HealthcareService | undefined }> => {
  let healthcareService: HealthcareService | undefined;

  const actorParams = await (async () => {
    if (resourceType === 'Location') {
      return [{ name: 'location', value: `Location/${resourceId}` }];
    }
    if (resourceType === 'Practitioner') {
      return [{ name: 'actor', value: `Practitioner/${resourceId}` }];
    }
    if (resourceType === 'HealthcareService') {
      const healthcareServiceAndMembers = await oystehr.fhir.search<HealthcareService | Location | Practitioner>({
        resourceType: 'HealthcareService',
        params: [
          {
            name: '_id',
            value: resourceId,
          },
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
        ],
      });
      const allResources = healthcareServiceAndMembers.unbundle();
      healthcareService = allResources.find(
        (resource) => resource.resourceType === 'HealthcareService'
      ) as HealthcareService;

      if (healthcareService && scheduleStrategyForHealthcareService(healthcareService) === ScheduleStrategy.owns) {
        return [{ name: 'actor', value: `HealthcareService/${resourceId}` }];
      }
      const locations = allResources.filter((resource) => resource.resourceType === 'Location') as Location[];
      const practitioners = allResources.filter(
        (resource) => resource.resourceType === 'Practitioner'
      ) as Practitioner[];

      const locationIdParams: string[] = [];
      const practitionerIdParams: string[] = [];

      if (healthcareService) {
        const scheduleStrategy = scheduleStrategyForHealthcareService(healthcareService);
        if (scheduleStrategy === ScheduleStrategy.poolsLocations || scheduleStrategy === ScheduleStrategy.poolsAll) {
          locationIdParams.push(...locations.map((location) => `Location/${location.id}`));
        }
        if (scheduleStrategy === ScheduleStrategy.poolsProviders || scheduleStrategy === ScheduleStrategy.poolsAll) {
          practitionerIdParams.push(
            ...practitioners.map((currentPractitioner) => `Practitioner/${currentPractitioner.id}`)
          );
        }

        if (scheduleStrategy === ScheduleStrategy.poolsLocations) {
          return [
            {
              name: 'actor',
              value: locationIdParams.join(','),
            },
          ];
        } else if (scheduleStrategy === ScheduleStrategy.poolsProviders) {
          return [
            {
              name: 'actor',
              value: practitionerIdParams.join(','),
            },
          ];
        } else if (scheduleStrategy === ScheduleStrategy.poolsAll) {
          return [
            {
              name: 'actor',
              value: [...locationIdParams, ...practitionerIdParams].join(','),
            },
          ];
        }
      }
    }
    return [];
  })();

  return {
    actorParams,
    healthcareService,
  };
};

export const getTimezoneResourceIdFromAppointment = (appointment: Appointment): string | undefined => {
  const locationRef = appointment.participant.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor
    ?.reference;
  if (locationRef) {
    return locationRef.split('/')[1];
  }

  const practitionerRef = appointment.participant.find((p) => p.actor?.reference?.startsWith('Practitioner/'))?.actor
    ?.reference;
  if (practitionerRef) {
    return practitionerRef.split('/')[1];
  }

  const healthcareServiceRef = appointment.participant.find((p) => p.actor?.reference?.startsWith('HealthcareService/'))
    ?.actor?.reference;
  if (healthcareServiceRef) {
    return healthcareServiceRef.split('/')[1];
  }

  return undefined;
};

export const makeEncounterBaseSearchParams = (): SearchParam[] => [
  { name: '_count', value: '1000' },
  { name: '_sort', value: '-date' },
  { name: '_include', value: 'Encounter:appointment' },
  { name: '_include', value: 'Encounter:participant' },
  { name: 'appointment._tag', value: OTTEHR_MODULE.IP },
  { name: 'status:not', value: 'planned' },
  { name: 'status:not', value: 'finished' },
  { name: 'status:not', value: 'cancelled' },
];

export const makeEncounterSearchParams = async ({
  resourceId,
  resourceType,
  cacheKey,
  oystehr,
}: {
  resourceId: string;
  resourceType: 'Location' | 'Practitioner' | 'HealthcareService';
  cacheKey: string;
  oystehr: Oystehr;
}): Promise<SearchParam[] | null> => {
  const cachedEncounterIds = encounterIdMap.get(cacheKey);

  const timezone = await getTimezone({
    oystehr,
    resourceType,
    resourceId,
  });

  const startDay = DateTime.now().setZone(timezone).startOf('day').toUTC().toISO();

  if (cachedEncounterIds !== null) {
    return [
      ...makeEncounterBaseSearchParams(),
      { name: 'appointment.date', value: `lt${startDay}` },
      ...(cachedEncounterIds ? [{ name: '_id', value: cachedEncounterIds }] : []),
      ...(resourceType === 'Location' ? [{ name: 'appointment.location', value: `Location/${resourceId}` }] : []),
      ...(resourceType === 'Practitioner' ? [{ name: 'appointment.actor', value: `Practitioner/${resourceId}` }] : []),
      ...(resourceType === 'HealthcareService'
        ? [{ name: 'appointment.actor', value: `HealthcareService/${resourceId}` }]
        : []),
    ];
  }

  return null;
};
