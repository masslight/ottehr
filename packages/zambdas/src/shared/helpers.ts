/* eslint-disable sort-keys */

import fetch from 'node-fetch';
import { SecretsKeys, getSecret } from './secrets';
import { Secrets } from '../types';
import { FhirClient } from '@zapehr/sdk';
import { Practitioner } from 'fhir/r4';

export async function getM2MUserProfile(token: string, secrets: Secrets | null): Promise<any> {
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const AUTH0_CLIENT = getSecret(SecretsKeys.AUTH0_CLIENT, secrets);

  try {
    const url = `${PROJECT_API}/m2m`;
    console.log('url', url);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-zapehr-project-id': PROJECT_ID,
      },
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch M2M user details: ${response.statusText}`);
    }

    const data = await response.json();

    const telemedDevice = data.find((device: any) => device.clientId === AUTH0_CLIENT);

    if (!telemedDevice) {
      throw new Error('No device matches the provided AUTH0_CLIENT');
    }

    console.log('device profile:', telemedDevice.profile);
    return telemedDevice.profile;
  } catch (error: any) {
    console.error('Error fetching M2M user details:', error);
    throw error;
  }
}

// Hard coded for testing until authentication is ready
export const createRoomEncounter = (
  providerProfile: string,
  providerName: string,
  deviceProfile: string,
  patientName: string,
  startTime: Date = new Date()
): any => ({
  encounter: {
    resourceType: 'Encounter',
    text: {
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Encounter for telemed room</div>',
    },
    contained: [
      {
        resourceType: 'Location',
        id: 'home',
        description: "Client's home",
        mode: 'kind',
      },
    ],
    status: 'arrived',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'HH',
      display: 'home health',
    },
    participant: [
      {
        individual: {
          reference: providerProfile,
          display: providerName,
        },
      },
    ],
    period: {
      start: startTime.toISOString(),
    },
    location: [
      {
        location: {
          reference: '#home',
          display: "Client's home",
        },
      },
    ],
    meta: {
      versionId: '47dfc118-025d-407a-9210-55ffc9dd198a',
      lastUpdated: '2023-10-17T14:36:05.672Z',
    },
    extension: [
      {
        url: 'https://extensions.fhir.zapehr.com/encounter-other-participants',
        extension: [
          {
            url: 'https://extensions.fhir.zapehr.com/encounter-other-participant',
            extension: [
              {
                url: 'period',
                valuePeriod: {
                  start: startTime.toISOString(),
                },
              },
              {
                url: 'reference',
                valueReference: {
                  reference: deviceProfile,
                  display: patientName,
                },
              },
            ],
          },
        ],
      },
    ],
  },
});

export const availability = async (id: string, slug: string, fhirClient: FhirClient): Promise<boolean> => {
  const practitioners: Practitioner[] = await fhirClient.searchResources({
    resourceType: 'Practitioner',
    searchParams: [
      {
        name: 'identifier',
        value: `${slug}`,
      },
    ],
  });

  const available = !practitioners.some(
    (practitioner) => practitioner.id !== id && practitioner.identifier?.some((identifier) => identifier.value === slug)
  );

  return available;
};
