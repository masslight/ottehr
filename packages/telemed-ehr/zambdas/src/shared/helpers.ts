import { AppClient, ClientConfig, FhirClient } from '@zapehr/sdk';
import { Appointment, Encounter, Person, RelatedPerson, Resource } from 'fhir/r4';
import { DateTime } from 'luxon';
import { EncounterVirtualServiceExtension, PUBLIC_EXTENSION_BASE_URL } from 'ehr-utils';
import { AppointmentInformation, Secrets } from '../types';
import { ENCOUNTER_VS_EXTENSION_CONVO_RELATIVE_URL, ENCOUNTER_VS_EXTENSION_URL } from './constants';
import { SecretsKeys, getSecret } from './secrets';
import { VisitStatusHistoryEntry } from './fhirStatusMappingUtils';

export function createFhirClient(token: string, secrets: Secrets | null): FhirClient {
  const FHIR_API = getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: FHIR_API,
    accessToken: token,
  };
  return new FhirClient(CLIENT_CONFIG);
}

export function createAppClient(token: string, secrets: Secrets | null): AppClient {
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: PROJECT_API,
    accessToken: token,
  };
  return new AppClient(CLIENT_CONFIG);
}

export const CancellationReasonCodes = {
  'Patient improved': 'patient-improved',
  'Wait time too long': 'wait-time',
  'Prefer another urgent care provider': 'prefer-another-provider',
  'Financial responsibility concern': 'financial-concern',
  'Insurance issue': 'insurance-issue',
  'Duplicate visit or account error': 'duplicate-visit-or-account-error',
};

export async function updateApptAndEncounterStatus(
  fhirClient: FhirClient,
  appointmentId: string,
  appointmentStatus: string,
  encounterStatus: string,
): Promise<void> {
  let arrivedIdx = 0;
  await fhirClient.patchResource({
    resourceType: 'Appointment',
    resourceId: appointmentId ?? '',
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: appointmentStatus,
      },
    ],
  });
  const res: Encounter[] = await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: 'appointment',
        value: `Appointment/${appointmentId}`,
      },
    ],
  });

  const encounter = res[0];

  if (encounter.statusHistory) {
    const arrivedHistory = encounter.statusHistory?.find((history) => history.status === 'arrived');
    arrivedIdx = arrivedHistory ? encounter.statusHistory.indexOf(arrivedHistory) : -1;
  } else {
    throw new Error('Encounter status history not found');
  }

  await fhirClient.patchResource({
    resourceType: 'Encounter',
    resourceId: encounter.id ?? '',
    operations: [
      {
        op: 'add',
        path: `/statusHistory/${arrivedIdx}/period/end`,
        value: DateTime.now().toISO(),
      },
      {
        op: 'replace',
        path: '/status',
        value: encounterStatus,
      },
      {
        op: 'add',
        path: `/statusHistory/${arrivedIdx + 1}`,
        value: {
          status: encounterStatus,
          period: {
            start: DateTime.now().toISO(),
          },
        },
      },
    ],
  });
}

const getTwilioConversationIdFromEncounter = (resource: Resource): string | undefined => {
  if (resource.resourceType !== 'Encounter') {
    return undefined;
  }
  const encounter = resource as Encounter;
  const extensions = encounter.extension ?? [];

  const vrExtension = extensions.find((ext) => {
    return ext.url === ENCOUNTER_VS_EXTENSION_URL;
  });

  if (!vrExtension) {
    return undefined;
  }
  const innerExtensions = vrExtension.extension ?? [];
  return innerExtensions.find((innerExt) => {
    return innerExt.url === ENCOUNTER_VS_EXTENSION_CONVO_RELATIVE_URL;
  })?.valueString;
};

export const isConversationEncounter = (resource: Resource): boolean => {
  if (resource.resourceType !== 'Encounter') {
    return false;
  }
  const encounter = resource as Encounter;
  return getTwilioConversationIdFromEncounter(encounter) !== undefined;
};

export interface TwilioConversationModel {
  conversationSID: string;
  encounterId: string;
  relatedPersonParticipants: Set<string>;
  clientPairing: number;
  //practitionerParticipants: Set<string>;
  //deviceParticipants: Set<string>;
}

const getMessagingNumberForEncounter = (persons: Person[], relatedPersonIds: string[]): number | undefined => {
  console.log('relatedpersons', relatedPersonIds);
  const matchingPerson = persons.find((person) => {
    const links = (person.link ?? [])
      .map((link) => {
        return link.target.reference;
      })
      .filter((ref) => ref != undefined && ref.startsWith('RelatedPerson'));
    return relatedPersonIds.some((id) => {
      return links.some((link) => link === `RelatedPerson/${id}`);
    });
  });
  if (matchingPerson?.id) {
    return (parseInt(matchingPerson.id.replace('-', ''), 16) % 20) + 1;
  }
  return undefined;
};

export const getConversationModelsFromResourceList = (resources: Resource[]): TwilioConversationModel[] => {
  const encounters = resources.filter((r) => isConversationEncounter(r)) as Encounter[];
  const persons = getPersonsFromResourceList(resources);

  const mapped = encounters.map((encounter) => {
    const convoId = getTwilioConversationIdFromEncounter(encounter) as string;
    const participants = encounter.participant ?? [];
    const relatedPersonParticipants = new Set<string>();

    participants.forEach((p) => {
      const participant = p.individual;
      const reference = participant?.reference;
      if (reference) {
        const [type, id] = reference.split('/');
        /*if (type === 'Device' && id) {
          deviceParticipants.add(id);
        }
        if (type === 'Practitioner' && id) {
          practitionerParticipants.add(id);
        }*/
        if (type === 'RelatedPerson' && id) {
          relatedPersonParticipants.add(id);
        }
      }
    });
    return {
      conversationSID: convoId,
      encounterId: encounter.id,
      clientPairing: getMessagingNumberForEncounter(persons, Array.from(relatedPersonParticipants)),
      relatedPersonParticipants,
    } as TwilioConversationModel;
  });
  return mapped.filter((model) => model.relatedPersonParticipants.size > 0 && model.clientPairing !== undefined);
};

export const getPersonsFromResourceList = (resources: Resource[]): Person[] => {
  return resources.filter((res) => res.resourceType === 'Person') as Person[];
};

export const getRelatedPersonsFromResourceList = (resources: Resource[]): RelatedPerson[] => {
  return resources.filter((res) => res.resourceType === 'RelatedPerson') as RelatedPerson[];
};

export const getVideoRoomResourceExtension = (resource: Resource): EncounterVirtualServiceExtension | null => {
  let resourcePrefix: string;
  let castedResource;
  if (resource.resourceType === 'Appointment') {
    castedResource = resource as Appointment;
    resourcePrefix = 'appointment';
  } else if (resource.resourceType === 'Encounter') {
    castedResource = resource as Encounter;
    resourcePrefix = 'encounter';
  } else {
    return null;
  }

  for (let index = 0; index < (castedResource.extension?.length ?? 0); index++) {
    const extension = castedResource.extension![index];
    if (extension.url !== `${PUBLIC_EXTENSION_BASE_URL}/${resourcePrefix}-virtual-service-pre-release`) {
      continue;
    }
    for (let j = 0; j < (extension?.extension?.length ?? 0); j++) {
      const internalExtension = extension.extension![j];
      if (
        internalExtension.url === 'channelType' &&
        internalExtension.valueCoding?.code === 'twilio-video-group-rooms'
      ) {
        return extension as EncounterVirtualServiceExtension;
      }
    }
  }
  return null;
};

export const getMinutesDifference = (startDateTime: string, endDateTime: string): number =>
  DateTime.fromISO(endDateTime).diff(DateTime.fromISO(startDateTime), 'minutes').minutes;

export const getCurrentTimeDifference = (startDateTime: string): number =>
  DateTime.now().diff(DateTime.fromISO(startDateTime), 'minutes').minutes;

export const getDurationOfStatus = (
  statusEntry: VisitStatusHistoryEntry,
  appointment: AppointmentInformation,
): number => {
  const { label, period } = statusEntry;
  const { start, visitStatusHistory } = appointment;

  if (label === 'pending') {
    if (period.end) {
      return getMinutesDifference(period.end, start);
    } else if (period.start) {
      return getCurrentTimeDifference(start);
    }
  }

  if (period.start && period.end) {
    return getMinutesDifference(period.start, period.end);
  } else if (period.start) {
    const stopCountingForStatus = ['canceled', 'no show', 'checked out'];

    if (stopCountingForStatus.includes(label)) {
      const prevStatusHistoryIdx = visitStatusHistory.length - 2;
      const prevEntry = visitStatusHistory[prevStatusHistoryIdx];
      return prevEntry ? getMinutesDifference(period.start, prevEntry.period.end || '') : 0;
    } else {
      return getCurrentTimeDifference(period.start);
    }
  } else {
    return 0;
  }
};
