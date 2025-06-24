// import { DateTime } from 'luxon';
// import { getDurationOfStatus, getVisitTotalTime } from 'utils';
import { Encounter } from 'fhir/r4b';
import { getVisitStatusHistory } from 'utils';
import { describe, expect, test } from 'vitest';

const finishedEncounter: Encounter = {
  resourceType: 'Encounter',
  status: 'finished',
  statusHistory: [
    {
      status: 'planned',
      period: {
        start: '2024-12-10T15:54:46.675Z',
        end: '2024-12-10T17:38:15.605Z',
      },
    },
    {
      status: 'arrived',
      period: {
        start: '2024-12-10T17:38:15.605Z',
        end: '2024-12-10T21:10:01.448Z',
      },
    },
    {
      status: 'in-progress',
      period: {
        start: '2024-12-10T21:10:01.448Z',
        end: '2024-12-10T22:00:01.448Z',
      },
    },
    {
      status: 'finished',
      period: {
        start: '2024-12-10T22:00:01.448Z',
      },
    },
  ],
  class: {
    system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
    code: 'ACUTE',
    display: 'inpatient acute',
  },
  subject: {
    reference: 'Patient/432964e3-f114-40d8-bd49-5dd8ba511f50',
  },
  appointment: [
    {
      reference: 'Appointment/8fae0218-3bde-403f-9338-4f8438413f32',
    },
  ],
  location: [
    {
      location: {
        reference: 'Location/9b7f5d54-eaf6-4b3e-b13c-3ee4be417d10',
      },
    },
  ],
  meta: {
    versionId: 'b4542438-6df4-4fa7-a536-68a32fc68417',
    lastUpdated: '2024-12-10T22:08:21.191Z',
  },
  participant: [
    {
      period: {
        start: '2024-12-10T21:10:01.448Z',
        end: '2024-12-10T21:17:52.393Z',
      },
      individual: {
        type: 'Practitioner',
        reference: 'Practitioner/502a540d-c5f1-4af1-81bc-215b104bc04c',
      },
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'ADM',
              display: 'admitter',
            },
          ],
        },
      ],
    },
    {
      period: {
        start: '2024-12-10T21:26:01.448Z',
        end: '2024-12-10T21:36:01.448Z',
      },
      individual: {
        type: 'Practitioner',
        reference: 'Practitioner/502a540d-c5f1-4af1-81bc-215b104bc04c',
      },
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'ATND',
              display: 'attender',
            },
          ],
        },
      ],
    },
  ],
};

const unexpectedPractitioner: Encounter = {
  resourceType: 'Encounter',
  status: 'finished',
  statusHistory: [
    {
      status: 'planned',
      period: {
        start: '2024-12-10T15:54:46.675Z',
        end: '2024-12-10T17:38:15.605Z',
      },
    },
    {
      status: 'arrived',
      period: {
        start: '2024-12-10T17:38:15.605Z',
        end: '2024-12-10T21:10:01.448Z',
      },
    },
    {
      status: 'in-progress',
      period: {
        start: '2024-12-10T21:10:01.448Z',
        end: '2024-12-10T22:00:01.448Z',
      },
    },
    {
      status: 'finished',
      period: {
        start: '2024-12-10T22:00:01.448Z',
      },
    },
  ],
  class: {
    system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
    code: 'ACUTE',
    display: 'inpatient acute',
  },
  subject: {
    reference: 'Patient/432964e3-f114-40d8-bd49-5dd8ba511f50',
  },
  appointment: [
    {
      reference: 'Appointment/8fae0218-3bde-403f-9338-4f8438413f32',
    },
  ],
  location: [
    {
      location: {
        reference: 'Location/9b7f5d54-eaf6-4b3e-b13c-3ee4be417d10',
      },
    },
  ],
  meta: {
    versionId: 'b4542438-6df4-4fa7-a536-68a32fc68417',
    lastUpdated: '2024-12-10T22:08:21.191Z',
  },
  participant: [
    {
      period: {
        start: '2024-12-10T21:10:01.448Z',
        end: '2024-12-10T21:17:52.393Z',
      },
      individual: {
        type: 'Practitioner',
        reference: 'Practitioner/502a540d-c5f1-4af1-81bc-215b104bc04c',
      },
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'nurse',
              display: 'Nurse',
            },
          ],
        },
      ],
    },
  ],
};

// todo add more tests for updated duration utils
describe('visit duration tests', () => {
  test('test visitStatusHistory for finished encounter ', () => {
    const visitStatusHistory = getVisitStatusHistory(finishedEncounter);
    expect(visitStatusHistory.length).toEqual(7);
  });
  test('test visitStatusHistory for encounter with an unexpected Practitioner', () => {
    const visitStatusHistory = getVisitStatusHistory(unexpectedPractitioner);
    expect(visitStatusHistory.length).toEqual(3);
  });
});
