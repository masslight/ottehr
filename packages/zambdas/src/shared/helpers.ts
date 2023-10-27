/* eslint-disable sort-keys */

export const CREATE_ROOM_VALID_ENCOUNTER = (
  userProfile = 'Practitioner/1ed0ff7e-1c5b-40d5-845b-3ae679de95cd',
  deviceProfile: string
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
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'HH',
      display: 'home health',
    },
    subject: {
      reference: 'Patient/13bf5b37-e0b8-42e0-8dcf-dc8c4aefc000',
    },
    participant: [
      {
        period: {
          start: '2015-01-17T16:00:00+10:00',
          end: '2015-01-17T16:30:00+10:00',
        },
        individual: {
          reference: userProfile,
          display: 'Dr Adam Careful',
        },
      },
    ],
    period: {
      start: '2015-01-17T16:00:00+10:00',
      end: '2015-01-17T16:30:00+10:00',
    },
    location: [
      {
        location: {
          reference: '#home',
          display: "Client's home",
        },
        status: 'completed',
        period: {
          start: '2015-01-17T16:00:00+10:00',
          end: '2015-01-17T16:30:00+10:00',
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
                  start: '2015-01-17T16:00:00+10:00',
                  end: '2015-01-17T16:30:00+10:00',
                },
              },
              {
                url: 'reference',
                valueReference: {
                  reference: deviceProfile,
                  display: 'M2M Client for anonymous patient access',
                },
              },
            ],
          },
        ],
      },
    ],
  },
});
