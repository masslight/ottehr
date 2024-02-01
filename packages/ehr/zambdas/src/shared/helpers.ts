import { FhirClient, ClientConfig, AppClient } from '@zapehr/sdk';
import { Encounter, Person, RelatedPerson, Resource } from 'fhir/r4';
import { DateTime } from 'luxon';
import { Secrets } from '../types';
import { SecretsKeys, getSecret } from './secrets';
import { ENCOUNTER_VS_EXTENSION_CONVO_RELATIVE_URL, ENCOUNTER_VS_EXTENSION_URL } from './constants';

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
  'Changing location': 'changing-location',
  'Changing to telemedicine': 'changing-telemedicine',
  'Financial responsibility concern': 'financial-concern',
  'Insurance issue': 'insurance-issue',
  'Service not offered at': 'service-not-offered',
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
  //practitionerParticipants: Set<string>;
  //deviceParticipants: Set<string>;
}

export const getConversationModelsFromResourceList = (resources: Resource[]): TwilioConversationModel[] => {
  const encounters = resources.filter((r) => isConversationEncounter(r)) as Encounter[];

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
      relatedPersonParticipants,
    } as TwilioConversationModel;
  });
  return mapped.filter((model) => model.relatedPersonParticipants.size > 0);
};

export const getPersonsFromResourceList = (resources: Resource[]): Person[] => {
  return resources.filter((res) => res.resourceType === 'Person') as Person[];
};

export const getRelatedPersonsFromResourceList = (resources: Resource[]): RelatedPerson[] => {
  return resources.filter((res) => res.resourceType === 'RelatedPerson') as RelatedPerson[];
};
