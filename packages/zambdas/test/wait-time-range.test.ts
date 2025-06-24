import { randomUUID } from 'crypto';
import { Appointment, Encounter, EncounterStatusHistory } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { AppointmentType, FhirAppointmentStatus, FhirEncounterStatus, getWaitingMinutes, WaitTimeRange } from 'utils';

let NOW: DateTime;

interface VisitDetails {
  appointment: Appointment;
  encounter: Encounter;
}

const makeAppointmentTypeCoding = (type: AppointmentType): { text: string } => {
  if (type === 'pre-booked') {
    return { text: 'prebook' };
  } else if (type === 'walk-in') {
    return { text: 'walkin' };
  } else {
    return { text: 'posttelemed' };
  }
};

const makeAppointment = (
  type: AppointmentType,
  startTime: string,
  appointmentStatus: FhirAppointmentStatus
): Appointment => {
  const adjustedStartTime = DateTime.fromISO(startTime).set({ second: 0, millisecond: 0 }).toISO() || '';
  return {
    resourceType: 'Appointment',
    id: randomUUID(),
    start: adjustedStartTime,
    appointmentType: makeAppointmentTypeCoding(type),
    participant: [
      {
        actor: { reference: 'Patient/99bb5986-47ee-4030-b9ff-2e25541bf9b9' },
        status: 'accepted',
      },
    ],
    status: appointmentStatus,
  };
};

const makeEncounter = (
  encounterStatus: FhirEncounterStatus,
  statusHistory: EncounterStatusHistory[],
  fhirAppointment: Appointment
): Encounter => {
  return {
    resourceType: 'Encounter',
    status: encounterStatus,
    statusHistory,
    class: {
      system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
      code: 'ACUTE',
      display: 'inpatient acute',
    },
    subject: {
      reference: 'Patient/07b1c9f6-cc11-4d48-bf31-56e2529c821e',
    },
    appointment: [
      {
        reference: `Appointment/${fhirAppointment}`,
      },
    ],
    location: [
      {
        location: {
          reference: 'Location/f2418766-0bf7-4ed9-9c88-b9d8044e7a37',
        },
      },
    ],
    id: randomUUID(),
  };
};

const makeWalkinVisit_Arrived = (minsAgoStart: number): VisitDetails => {
  const startTime = NOW.minus({ minutes: minsAgoStart }).toISO() ?? 'FAIL';
  const appointment = makeAppointment('walk-in', startTime, 'arrived');

  const statusHistory: EncounterStatusHistory[] = [
    {
      status: 'arrived',
      period: {
        start: startTime,
      },
    },
  ];

  const encounter = makeEncounter('arrived', statusHistory, appointment);

  return { appointment, encounter };
};

const makeVisit_Arrived = (
  type: AppointmentType,
  startTimeMinsAgo: number,
  arrivedTimeMinsAgo: number
): VisitDetails => {
  const bookingTime = NOW.minus({ days: 1 }).toISO() ?? 'FAIL';
  const startTime = NOW.minus({ minutes: startTimeMinsAgo }).toISO() ?? 'FAIL';
  const arrivedTime = NOW.minus({ minutes: arrivedTimeMinsAgo }).toISO() ?? 'FAIL';
  const appointment = makeAppointment(type, startTime, 'arrived');

  const statusHistory: EncounterStatusHistory[] = [
    {
      status: 'planned',
      period: {
        start: bookingTime,
        end: arrivedTime,
      },
    },
    {
      status: 'arrived',
      period: {
        start: arrivedTime,
      },
    },
  ];

  const encounter = makeEncounter('arrived', statusHistory, appointment);

  return { appointment, encounter };
};

beforeAll(() => {
  NOW = DateTime.now().setZone('America/New_York');
});

describe('test waiting minutes estimate calculation', () => {
  test('1: calculate wait time when no is in the office', () => {
    const result = getWaitingMinutes(NOW, []);
    const expectedRange: WaitTimeRange = { low: 0, high: 15 };

    expect(result).toBe(expectedRange.low);
    expect(result + 15).toBe(expectedRange.high);
  });

  test('2: calculate wait time based on 1 walkin waiting for 10 minutes', () => {
    const walkin10MinsAgo = makeWalkinVisit_Arrived(10);

    const result = getWaitingMinutes(NOW, [walkin10MinsAgo.encounter]);
    const expectedRange: WaitTimeRange = { low: 10, high: 25 };

    expect(result).toBe(expectedRange.low);
    expect(result + 15).toBe(expectedRange.high);
  });

  test('3: calculate wait time based on 1 walkin waiting for 10 minutes, 1 prebook waiting for 5', () => {
    const walkin10MinsAgo = makeWalkinVisit_Arrived(10);
    const prebooked15MinEarly = makeVisit_Arrived('pre-booked', -15, 5);

    const result = getWaitingMinutes(NOW, [walkin10MinsAgo.encounter, prebooked15MinEarly.encounter]);
    const expectedRange: WaitTimeRange = { low: 10, high: 25 };

    expect(result).toBe(expectedRange.low);
    expect(result + 15).toBe(expectedRange.high);
  });

  test('4: calculate wait time based on 3 waiting, longest has been there for 30 minutes', () => {
    const walkin10MinsAgo = makeWalkinVisit_Arrived(10);
    const walkin30MinsAgo = makeWalkinVisit_Arrived(30);
    const prebooked15MinEarly = makeVisit_Arrived('pre-booked', -15, 5);

    const encounters = [walkin10MinsAgo.encounter, walkin30MinsAgo.encounter, prebooked15MinEarly.encounter];
    const result = getWaitingMinutes(NOW, encounters);
    const expectedRange: WaitTimeRange = { low: 30, high: 45 };

    expect(result).toBe(expectedRange.low);
    expect(result + 15).toBe(expectedRange.high);
  });

  test('4: calculate wait time based on 3 waiting, longest has been there for 41 minutes', () => {
    const walkin10MinsAgo = makeWalkinVisit_Arrived(10);
    const walkin30MinsAgo = makeWalkinVisit_Arrived(30);
    const prebookedEarly = makeVisit_Arrived('pre-booked', 0, 41);

    const encounters = [prebookedEarly.encounter, walkin10MinsAgo.encounter, walkin30MinsAgo.encounter];
    const result = getWaitingMinutes(NOW, encounters);
    const expectedRange: WaitTimeRange = { low: 41, high: 56 };

    expect(result).toBe(expectedRange.low);
    expect(result + 15).toBe(expectedRange.high);
  });
});
