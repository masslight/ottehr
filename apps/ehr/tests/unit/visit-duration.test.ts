// import { DateTime } from 'luxon';
// import { getDurationOfStatus, getVisitTotalTime } from 'utils';
import { Appointment, Encounter, EncounterStatusHistory, Period } from 'fhir/r4b';
import { FHIR_EXTENSION, PARTICIPATION_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { getVisitStatusHistory } from 'utils/lib/utils/visitUtils';
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

const T = {
  created: '2024-12-10T15:00:00.000Z',
  waitingRoom: '2024-12-10T15:20:00.000Z',
  ready: '2024-12-10T16:00:00.000Z',
  intake: '2024-12-10T16:30:00.000Z',
};

const ottehrEntry = (
  fhirStatus: EncounterStatusHistory['status'],
  ottehrStatus: string,
  period: Period
): EncounterStatusHistory => ({
  status: fhirStatus,
  period,
  extension: [{ url: FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url, valueCode: ottehrStatus }],
});

const encounterWith = (statusHistory: EncounterStatusHistory[]): Encounter => ({
  resourceType: 'Encounter',
  status: statusHistory[statusHistory.length - 1].status,
  statusHistory,
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR' },
  subject: { reference: 'Patient/test' },
});

const onDemandVirtualAppointment: Appointment = {
  resourceType: 'Appointment',
  status: 'arrived',
  participant: [],
  meta: { tag: [{ code: OTTEHR_MODULE.TM }] },
  appointmentType: { text: 'walkin' },
};

const inPersonAppointment: Appointment = {
  resourceType: 'Appointment',
  status: 'arrived',
  participant: [],
  meta: { tag: [{ code: OTTEHR_MODULE.IP }] },
  appointmentType: { text: 'prebook' },
};

describe('getVisitStatusHistory — on-demand virtual visits', () => {
  test('reads the open planned window as arrived', () => {
    const history = getVisitStatusHistory(
      encounterWith([{ status: 'planned', period: { start: T.created } }]),
      onDemandVirtualAppointment
    );

    expect(history).toEqual([{ status: 'arrived', period: { start: T.created } }]);
  });

  test('keeps arrived once the visit moves on without the patient ever opening the waiting room', () => {
    const history = getVisitStatusHistory(
      encounterWith([
        { status: 'planned', period: { start: T.created, end: T.ready } },
        ottehrEntry('arrived', 'ready', { start: T.ready }),
      ]),
      onDemandVirtualAppointment
    );

    expect(history).toEqual([
      { status: 'arrived', period: { start: T.created, end: T.ready } },
      { status: 'ready', period: { start: T.ready } },
    ]);
  });

  test('a recorded arrival wins over the planned window, which is not reported twice', () => {
    const history = getVisitStatusHistory(
      encounterWith([
        { status: 'planned', period: { start: T.created, end: T.waitingRoom } },
        ottehrEntry('arrived', 'arrived', { start: T.waitingRoom, end: T.ready }),
        ottehrEntry('arrived', 'ready', { start: T.ready }),
      ]),
      onDemandVirtualAppointment
    );

    expect(history).toEqual([
      { status: 'arrived', period: { start: T.waitingRoom, end: T.ready } },
      { status: 'ready', period: { start: T.ready } },
    ]);
  });

  test('a legacy arrival without the extension also wins over the planned window', () => {
    const history = getVisitStatusHistory(
      encounterWith([
        { status: 'planned', period: { start: T.created, end: T.waitingRoom } },
        { status: 'arrived', period: { start: T.waitingRoom } },
      ]),
      onDemandVirtualAppointment
    );

    expect(history).toEqual([{ status: 'arrived', period: { start: T.waitingRoom } }]);
  });

  test('reads the planned window as pending when the appointment is not known to be on-demand virtual', () => {
    const statusHistory: EncounterStatusHistory[] = [
      { status: 'planned', period: { start: T.created, end: T.ready } },
      ottehrEntry('arrived', 'ready', { start: T.ready }),
    ];

    expect(getVisitStatusHistory(encounterWith(statusHistory)).map((h) => h.status)).toEqual(['pending', 'ready']);
  });
});

describe('getVisitStatusHistory — statuses the encounter never recorded', () => {
  test('does not invent arrived for an in-person visit moved straight from pending to ready', () => {
    const history = getVisitStatusHistory(
      encounterWith([
        { status: 'planned', period: { start: T.created, end: T.ready } },
        ottehrEntry('arrived', 'ready', { start: T.ready }),
      ]),
      inPersonAppointment
    );

    expect(history.map((h) => h.status)).toEqual(['pending', 'ready']);
  });

  test('does not invent statuses skipped mid-visit', () => {
    const history = getVisitStatusHistory(
      encounterWith([
        ottehrEntry('arrived', 'arrived', { start: T.created, end: T.ready }),
        ottehrEntry('arrived', 'ready', { start: T.ready, end: T.intake }),
        ottehrEntry('in-progress', 'provider', { start: T.intake }),
      ]),
      inPersonAppointment
    );

    expect(history.map((h) => h.status)).toEqual(['arrived', 'ready', 'provider']);
  });

  test('does not mutate the encounter it reads', () => {
    const encounter = encounterWith([
      { status: 'planned', period: { start: T.created, end: T.ready } },
      ottehrEntry('arrived', 'ready', { start: T.ready }),
    ]);
    const before = structuredClone(encounter);

    getVisitStatusHistory(encounter, onDemandVirtualAppointment);

    expect(encounter).toEqual(before);
  });
});
