import { Encounter, EncounterStatusHistory } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FhirEncounterStatus } from 'utils';
import { expect, test } from 'vitest';
import { getWaitingTimeForAppointment } from '../src/shared/waitTimeUtils';

const makeEncounter = (statusHistory: EncounterStatusHistory[], status: FhirEncounterStatus): Encounter => {
  return {
    resourceType: 'Encounter',
    status,
    statusHistory,
    class: {
      system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
      code: 'ACUTE',
      display: 'inpatient acute',
    },
  };
};

test('waiting time, no ready for provider, no discharged', () => {
  const statusHistory: EncounterStatusHistory[] = [
    {
      status: 'planned',
      period: {
        start: '2024-02-01T23:07:35.152Z',
        end: '2024-02-02T00:33:20.149Z',
      },
    },
    {
      status: 'arrived',
      period: {
        start: '2024-02-02T00:33:20.149Z',
        end: '2024-02-02T00:37:48.744Z',
      },
    },
    {
      status: 'in-progress',
      period: {
        start: '2024-02-02T00:37:48.744Z',
        end: '2024-02-02T01:00:33.464Z',
      },
    },
    {
      status: 'finished',
      period: {
        start: '2024-02-02T01:00:33.464Z',
      },
    },
  ];
  const encounter = makeEncounter(statusHistory, 'finished');
  const waitingTime = getWaitingTimeForAppointment(encounter);
  console.log('waitingTime', waitingTime);

  // the start of 'ARR' status
  const start = DateTime.fromISO('2024-02-02T00:33:20.149Z').toSeconds();
  // the start of 'CHK' status
  const end = DateTime.fromISO('2024-02-02T01:00:33.464Z').toSeconds();
  const expectedWT = Math.round((end - start) / 60);

  expect(waitingTime).toBeGreaterThan(0);
  expect(waitingTime).toEqual(expectedWT);
});

test('waiting time, canceled appointment', () => {
  const statusHistory: EncounterStatusHistory[] = [
    {
      status: 'planned',
      period: {
        start: '2024-02-01T23:18:22.359Z',
        end: '2024-02-02T00:15:09.184Z',
      },
    },
    {
      status: 'arrived',
      period: {
        start: '2024-02-02T00:15:09.185Z',
        end: '2024-02-02T00:41:33.714Z',
      },
    },
    {
      status: 'cancelled',
      period: {
        start: '2024-02-02T00:41:33.714Z',
      },
    },
  ];

  const encounter = makeEncounter(statusHistory, 'cancelled');
  const waitingTime = getWaitingTimeForAppointment(encounter);

  // the start of 'ARR' status
  const start = DateTime.fromISO('2024-02-02T00:15:09.185Z').toSeconds();
  // the start of 'CANC' status
  const end = DateTime.fromISO('2024-02-02T00:41:33.714Z').toSeconds();
  const expectedWT = Math.round((end - start) / 60);

  expect(waitingTime).toBeGreaterThan(0);
  expect(waitingTime).toEqual(expectedWT);
});

test('waiting time, pending then canceled appointment', () => {
  const statusHistory: EncounterStatusHistory[] = [
    {
      status: 'planned',
      period: {
        start: '2024-02-01T23:18:22.359Z',
        end: '2024-02-02T00:15:09.184Z',
      },
    },
    {
      status: 'cancelled',
      period: {
        start: '2024-02-02T00:15:09.184Z',
      },
    },
  ];

  const encounter = makeEncounter(statusHistory, 'cancelled');
  const waitingTime = getWaitingTimeForAppointment(encounter);

  expect(waitingTime).toEqual(0);
  expect(waitingTime).toEqual(0);
});

test('waiting time, no show appointment', () => {
  const statusHistory: EncounterStatusHistory[] = [
    {
      status: 'planned',
      period: {
        start: '2024-02-01T23:18:22.359Z',
        end: '2024-02-02T00:15:09.184Z',
      },
    },
    {
      status: 'cancelled',
      period: {
        start: '2024-02-02T00:15:09.184Z',
      },
    },
  ];

  const encounter = makeEncounter(statusHistory, 'cancelled');
  const waitingTimeProd = getWaitingTimeForAppointment(encounter);

  expect(waitingTimeProd).toEqual(0);
});

test('waiting time, no provider, no ready for provider and no discharged', () => {
  const statusHistory: EncounterStatusHistory[] = [
    {
      status: 'planned',
      period: {
        start: '2024-02-01T23:07:35.152Z',
        end: '2024-02-02T00:33:20.149Z',
      },
    },
    {
      status: 'arrived',
      period: {
        start: '2024-02-02T00:33:20.149Z',
        end: '2024-02-02T00:37:48.744Z',
      },
    },
    {
      status: 'in-progress',
      period: {
        start: '2024-02-02T00:37:48.744Z',
        end: '2024-02-02T00:38:04.147Z',
      },
    },
    {
      status: 'arrived',
      period: {
        start: '2024-02-02T00:38:04.147Z',
        end: '2024-02-02T00:42:04.669Z',
      },
    },
    {
      status: 'in-progress',
      period: {
        start: '2024-02-02T00:42:04.669Z',
        end: '2024-02-02T00:47:49.187Z',
      },
    },
    {
      status: 'finished',
      period: {
        start: '2024-02-02T00:47:49.187Z',
      },
    },
  ];
  const encounter = makeEncounter(statusHistory, 'finished');
  const waitingTimeProd = getWaitingTimeForAppointment(encounter);

  // most recent arrived start time
  const start = DateTime.fromISO('2024-02-02T00:38:04.147Z').toSeconds();
  // the start of finished status
  const end = DateTime.fromISO('2024-02-02T00:47:49.187Z').toSeconds();
  const expectedWT = Math.round((end - start) / 60);

  expect(waitingTimeProd).toBeGreaterThan(0);
  expect(waitingTimeProd).toEqual(expectedWT);
});
