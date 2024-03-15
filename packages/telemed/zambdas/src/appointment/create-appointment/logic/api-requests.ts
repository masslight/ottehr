import { FhirClient, User } from '@zapehr/sdk';
import { Encounter, Person, RelatedPerson, Resource } from 'fhir/r4';
import { PatientInfo } from 'ottehr-utils';

export const createEncounterForConversation = async (
  fhirClient: FhirClient,
  relatedPerson: RelatedPerson,
  deviceID: string,
): Promise<Encounter> => {
  return await fhirClient.createResource<Encounter>({
    resourceType: 'Encounter',
    status: 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'VR', // Virtual
    },
    participant: [
      {
        individual: {
          reference: `RelatedPerson/${relatedPerson.id}`,
        },
      },
    ],
    extension: [
      {
        url: 'https://extensions.fhir.zapehr.com/encounter-other-participants',
        extension: [
          {
            url: 'https://extensions.fhir.zapehr.com/encounter-other-participant',
            extension: [
              {
                url: 'reference',
                valueReference: {
                  reference: `Device/${deviceID}`,
                },
              },
            ],
          },
        ],
      },
    ],
  });
};

export const createConversation = async (
  projectApiURL: string,
  zapehrToken: string,
  encounter: Encounter,
): Promise<Response> => {
  return await fetch(`${projectApiURL}/messaging/conversation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${zapehrToken}`,
    },
    body: JSON.stringify({
      encounter: encounter,
    }),
  });
};

export const addParticipantsToConversation = async (
  projectApiURL: string,
  conversationSID: string,
  zapehrToken: string,
  encounter: Encounter,
  deviceID: string,
  person: Person,
  user: User,
  patient: PatientInfo,
): Promise<Response> => {
  return await fetch(`${projectApiURL}/messaging/conversation/${conversationSID}/participant`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${zapehrToken}`,
    },
    body: JSON.stringify({
      encounterReference: `Encounter/${encounter.id}`,
      participants: [
        {
          participantReference: `Device/${deviceID}`,
          channel: 'chat',
        },
        {
          participantReference: `Person/${person.id}`,
          channel: 'sms',
          phoneNumber: user.name.startsWith('+')
            ? person.telecom?.find((telecomTemp) => telecomTemp.system === 'phone')?.value
            : patient.phoneNumber,
        },
      ],
    }),
  });
};

export const getEncountersForRelatedPersons = async (
  fhirClient: FhirClient,
  relatedPersonIDs: string[],
): Promise<Resource[]> => {
  return await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: 'participant',
        value: relatedPersonIDs.join(','),
      },
      {
        name: 'class',
        value: 'VR',
      },
    ],
  });
};

export const addRelatedPersonToEncounter = async (
  fhirClient: FhirClient,
  encounterId: string,
  relatedPerson: RelatedPerson,
): Promise<Encounter> => {
  return await fhirClient.patchResource<Encounter>({
    resourceType: 'Encounter',
    resourceId: encounterId,
    operations: [
      {
        op: 'add',
        path: '/participant/0',
        value: {
          individual: {
            reference: `RelatedPerson/${relatedPerson.id}`,
          },
        },
      },
    ],
  });
};
