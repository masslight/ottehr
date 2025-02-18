import Oystehr, { Bundle, SearchParam } from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource, Practitioner, Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { AppointmentParticipants, OTTEHR_MODULE, PARTICIPANT_TYPE, ParticipantInfo } from 'utils';

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
  resourceTimezone,
}: {
  resourceId: string;
  resourceType: 'Location' | 'Practitioner' | 'HealthcareService';
  resourceTimezone: string | undefined;
}): string => {
  return `${resourceType}|${resourceId}|${DateTime.now().setZone(resourceTimezone).startOf('day').toISODate()}`;
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
  resourceType: string;
  resourceId: string;
}): Promise<string | undefined> => {
  let timezone: string | undefined;

  if (!timezoneMap.has(resourceId)) {
    try {
      const resource = await oystehr.fhir.get<Location>({
        resourceType,
        id: resourceId,
      });
      timezone = resource?.extension?.find(
        (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
      )?.valueString;

      if (timezone) {
        timezoneMap.set(resourceId, timezone);
        console.log(`timezone found for ${resourceId} and added to timezoneMap`, timezone);
      } else {
        console.error(`timezone not setted for ${resourceId}`);
      }
    } catch (e) {
      console.log('error getting location', JSON.stringify(e));
      throw new Error('location is not found');
    }
  }
  return timezoneMap.get(resourceId);
};

export const makeAppointmentSearchRequest = async ({
  oystehr,
  resourceId,
  resourceType,
  searchDate,
}: {
  oystehr: Oystehr;
  resourceId: string;
  resourceType: 'Location' | 'Practitioner' | 'HealthcareService';
  searchDate: string;
}): Promise<{ resourceType: 'Appointment'; params: SearchParam[] }> => {
  const timezone = await getTimezone({
    oystehr,
    resourceType,
    resourceId,
  });

  const searchDateWithTimezone = DateTime.fromISO(searchDate).setZone(timezone);

  return {
    resourceType: 'Appointment',
    params: [
      {
        name: 'date',
        value: `ge${searchDateWithTimezone.startOf('day')}`,
      },
      {
        name: 'date',
        value: `le${searchDateWithTimezone.endOf('day')}`,
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

      ...(resourceType === 'Location' ? [{ name: 'location', value: `Location/${resourceId}` }] : []),
      ...(resourceType === 'Practitioner' ? [{ name: 'actor', value: `Practitioner/${resourceId}` }] : []),
      ...(resourceType === 'HealthcareService' ? [{ name: 'actor', value: `HealthcareService/${resourceId}` }] : []),
    ],
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

export const makeEncounterBaseSearchParamsByTimezone = (timezone: string | undefined): SearchParam[] => [
  { name: '_count', value: '1000' },
  { name: '_include', value: 'Encounter:appointment' },
  { name: '_include', value: 'Encounter:participant' },
  { name: 'appointment._tag', value: OTTEHR_MODULE.IP },
  { name: 'appointment.date', value: `lt${DateTime.now().setZone(timezone).startOf('day')}` },
  { name: 'status:not', value: 'planned' },
  { name: 'status:not', value: 'finished' },
  { name: 'status:not', value: 'cancelled' },
];

export const makeEncounterSearchParams = ({
  resourceId,
  resourceType,
  resourceTimezone,
  cacheKey,
}: {
  resourceId: string;
  resourceType: 'Location' | 'Practitioner' | 'HealthcareService';
  resourceTimezone: string | undefined;
  cacheKey: string;
}): SearchParam[] | null => {
  if (!resourceTimezone) {
    console.log(`WARNING: encounter search params for ${resourceType}/${resourceId} prepared without timezone`);
  }

  const cachedEncounterIds = encounterIdMap.get(cacheKey);

  if (cachedEncounterIds !== null) {
    return [
      ...makeEncounterBaseSearchParamsByTimezone(resourceTimezone),
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
