/* eslint-disable sort-keys */

import fetch from 'node-fetch';
import { SecretsKeys, getSecret } from './secrets';

export async function getM2MUserProfile(token: string): Promise<any> {
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, null);
  const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, null);
  const AUTH0_CLIENT = getSecret(SecretsKeys.AUTH0_CLIENT, null);

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
  userProfile = 'Practitioner/1ed0ff7e-1c5b-40d5-845b-3ae679de95cd',
  deviceProfile: string,
  patientFirstName: string,
  patientLastName: string,
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
          reference: userProfile,
          display: 'Dr Adam Careful',
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
                  display: `${patientFirstName} ${patientLastName}`,
                },
              },
            ],
          },
        ],
      },
    ],
  },
});
