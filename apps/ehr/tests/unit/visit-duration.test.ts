// import { DateTime } from 'luxon';
// import { getDurationOfStatus, getVisitTotalTime } from 'utils';
import { Encounter } from 'fhir/r4b';
import { FHIR_EXTENSION, PARTICIPATION_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { getVisitStatusHistory } from 'utils/lib/utils/visitUtils';
import { describe, expect, test } from 'vitest';

const OTTEHR_VISIT_STATUS_URL = FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url;

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
              system: PARTICIPATION_CODE_SYSTEM,
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
              system: PARTICIPATION_CODE_SYSTEM,
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
              system: PARTICIPATION_CODE_SYSTEM,
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

describe('getVisitStatusHistory — in-person arrived status preservation', () => {
  // Reproduces the bug: pre-booked in-person visit where the encounter transitioned directly
  // from 'planned' to 'arrived'(ext='ready') without an explicit 'arrived'(ext='arrived') entry.
  // This happens when the appointment becomes 'arrived' but the encounter is not updated
  // before the visit is moved to 'ready'.
  test('injects synthetic arrived entry when encounter skipped arrived state before ready', () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'arrived',
      statusHistory: [
        {
          status: 'planned',
          period: { start: '2024-12-10T15:00:00.000Z', end: '2024-12-10T16:00:00.000Z' },
        },
        {
          status: 'arrived',
          period: { start: '2024-12-10T16:00:00.000Z' },
          extension: [{ url: OTTEHR_VISIT_STATUS_URL, valueCode: 'ready' }],
        },
      ],
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
      subject: { reference: 'Patient/test' },
    };

    const history = getVisitStatusHistory(encounter);
    const statuses = history.map((h) => h.status);

    expect(statuses).toContain('arrived');
    expect(statuses).toContain('ready');
    // 'arrived' must appear before 'ready'
    expect(statuses.indexOf('arrived')).toBeLessThan(statuses.indexOf('ready'));
  });

  test('does not duplicate arrived when encounter has explicit arrived entry', () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'arrived',
      statusHistory: [
        {
          status: 'planned',
          period: { start: '2024-12-10T15:00:00.000Z', end: '2024-12-10T16:00:00.000Z' },
        },
        {
          status: 'arrived',
          period: { start: '2024-12-10T16:00:00.000Z', end: '2024-12-10T16:30:00.000Z' },
          extension: [{ url: OTTEHR_VISIT_STATUS_URL, valueCode: 'arrived' }],
        },
        {
          status: 'arrived',
          period: { start: '2024-12-10T16:30:00.000Z' },
          extension: [{ url: OTTEHR_VISIT_STATUS_URL, valueCode: 'ready' }],
        },
      ],
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
      subject: { reference: 'Patient/test' },
    };

    const history = getVisitStatusHistory(encounter);
    const arrivedEntries = history.filter((h) => h.status === 'arrived');

    expect(arrivedEntries.length).toEqual(1);
    expect(history.map((h) => h.status)).toEqual(['pending', 'arrived', 'ready']);
  });

  test('does not inject arrived for walk-in visits that start as arrived', () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'arrived',
      statusHistory: [
        {
          // Walk-in initial entry: FHIR 'arrived' with no ottehr extension
          status: 'arrived',
          period: { start: '2024-12-10T16:00:00.000Z', end: '2024-12-10T16:30:00.000Z' },
        },
        {
          status: 'arrived',
          period: { start: '2024-12-10T16:30:00.000Z' },
          extension: [{ url: OTTEHR_VISIT_STATUS_URL, valueCode: 'ready' }],
        },
      ],
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
      subject: { reference: 'Patient/test' },
    };

    const history = getVisitStatusHistory(encounter);
    // Path 3 handles the initial no-ext arrived entry; no duplicate injection
    expect(history.map((h) => h.status)).toEqual(['arrived', 'ready']);
  });
});
