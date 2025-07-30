import { randomUUID } from 'crypto';
import { Appointment, Encounter, EncounterStatusHistory } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AppointmentType,
  FhirAppointmentStatus,
  FhirEncounterStatus,
  visitStatusToFhirAppointmentStatusMap,
  visitStatusToFhirEncounterStatusMap,
  VisitStatusWithoutUnknown,
} from 'utils';
import { beforeAll, expect, test } from 'vitest';
import { HOP_QUEUE_URI } from '../src/shared/constants';
import { sortAppointments } from '../src/shared/queueingUtils';

let NOW: DateTime;

interface VisitDetails {
  appointment: Appointment;
  encounter: Encounter;
}

const applyHop = (visit: VisitDetails): VisitDetails => {
  const { appointment, encounter } = visit;
  const hoppedAppointment = {
    ...appointment,
    meta: {
      tag: [
        {
          system: HOP_QUEUE_URI,
          code: DateTime.now().toISO() || '',
        },
      ],
    },
  };
  return { appointment: hoppedAppointment, encounter };
};

const makeAppointmentTypeCoding = (type: AppointmentType): { text: string } => {
  if (type === 'pre-booked') {
    return { text: 'prebook' };
  } else if (type === 'walk-in') {
    return { text: 'walkin' };
  } else {
    return { text: 'posttelemed' };
  }
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

const makeAppointment = (
  type: AppointmentType,
  startTime: string,
  appointmentStatus: FhirAppointmentStatus
): Appointment => {
  return {
    resourceType: 'Appointment',
    id: randomUUID(),
    start: startTime,
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

const makeVisit_Pending = (type: AppointmentType, startTimeMinsAgo: number): VisitDetails => {
  const bookingTime = NOW.minus({ days: 1 }).toISO() ?? 'FAIL';
  const startTime = NOW.minus({ minutes: startTimeMinsAgo }).toISO() ?? 'FAIL';
  const appointment = makeAppointment(type, startTime, 'booked');

  const statusHistory: EncounterStatusHistory[] = [
    {
      status: 'planned',
      period: {
        start: bookingTime,
      },
    },
  ];

  const encounter = makeEncounter('planned', statusHistory, appointment);

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

const addNewStatusToVisit = (
  visit: VisitDetails,
  status: VisitStatusWithoutUnknown,
  timeInLastStatus: number
): VisitDetails => {
  const endTime = NOW.minus({
    minutes: timeInLastStatus,
  }).toISO()!;

  const updatedAppointmentStatus = visitStatusToFhirAppointmentStatusMap[status];
  const updatedEncounterStatus = visitStatusToFhirEncounterStatusMap[status];

  visit.appointment.status = updatedAppointmentStatus;
  visit.encounter.status = updatedEncounterStatus;

  const newStatusHistory: EncounterStatusHistory = {
    status: updatedEncounterStatus,
    period: {
      start: endTime,
    },
  };
  const encounterStatusHistory = visit.encounter.statusHistory;
  const curStatus = encounterStatusHistory?.find((h) => !h.period.end);
  if (encounterStatusHistory) {
    if (curStatus) {
      curStatus.period.end = endTime;
    }
    encounterStatusHistory.push(newStatusHistory);
  } else {
    visit.encounter.statusHistory = [newStatusHistory];
  }

  if (status === 'intake') {
    addParticipant(visit.encounter, 'ADM', 'admitter', endTime);
  }

  if (status === 'ready for provider') {
    const curParticipant = visit.encounter.participant;
    if (curParticipant?.length) {
      const lastParticipant = curParticipant?.[curParticipant.length - 1];
      curParticipant[curParticipant.length - 1].period = { start: lastParticipant.period?.start, end: endTime };
    } else {
      addParticipant(visit.encounter, 'ADM', 'admitter', endTime, endTime);
    }
  }

  if (status === 'discharged') {
    const curParticipant = visit.encounter.participant;
    if (curParticipant?.length) {
      const lastParticipant = curParticipant?.[curParticipant.length - 1];
      curParticipant[curParticipant.length - 1].period = { start: lastParticipant.period?.start, end: endTime };
    } else {
      addParticipant(visit.encounter, 'ATND', 'attender', endTime, endTime);
    }
  }

  return visit;
};

const addParticipant = (
  encounter: Encounter,
  participantCode: string,
  participantDisplay: string,
  start: string,
  end?: string
): Encounter => {
  const curParticipant = encounter.participant;
  const newParticipant = {
    period: {
      start,
      end,
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
            code: participantCode,
            display: participantDisplay,
          },
        ],
      },
    ],
  };
  if (curParticipant?.length) {
    curParticipant.push(newParticipant);
  } else {
    encounter.participant = [newParticipant];
  }
  return encounter;
};

const getAppointmentsAndMap = (
  visits: VisitDetails[]
): { appointments: Appointment[]; apptRefToEncounterMap: Record<string, Encounter> } => {
  const appointments = visits.map((visit) => visit.appointment);
  const apptRefToEncounterMap = visits.reduce((acc: Record<string, Encounter>, visit) => {
    acc[`Appointment/${visit.appointment.id}`] = visit.encounter;
    return acc;
  }, {});
  return { appointments, apptRefToEncounterMap };
};

beforeAll(() => {
  NOW = DateTime.now();
});

test('arrived patients queue', async () => {
  const prebooked15MinEarlyAppt = makeVisit_Arrived('pre-booked', -15, 3);
  const preBooked17MinEarly = makeVisit_Arrived('pre-booked', -17, 10);
  const prebooked15MinEarly2 = makeVisit_Arrived('pre-booked', -15, 1);
  const hoppedPrebook30Early = applyHop(makeVisit_Arrived('pre-booked', -30, 1));
  const walkinJustNow = makeWalkinVisit_Arrived(1);
  const walkin75MinsAgo = makeWalkinVisit_Arrived(75);
  const prebookedRightOnTime = makeVisit_Arrived('pre-booked', 0, 0);
  const prebookedAlmostRightOnTime = makeVisit_Arrived('pre-booked', 0, 2);
  const walkin11MinsAgo = makeWalkinVisit_Arrived(11);
  const postTelemedOne = makeVisit_Arrived('post-telemed', 30, 5);
  const postTelemedTwo = makeVisit_Arrived('post-telemed', 0, 10);
  await new Promise((resolve) => setTimeout(resolve, 10)); // make sure this appointment is hopped after the first
  const hoppedWalkin11MinsAgo = applyHop(makeWalkinVisit_Arrived(11));

  const visits: VisitDetails[] = [
    prebooked15MinEarlyAppt,
    preBooked17MinEarly,
    postTelemedTwo,
    walkinJustNow,
    walkin75MinsAgo,
    prebookedRightOnTime,
    walkin11MinsAgo,
    prebooked15MinEarly2,
    postTelemedOne,
    prebookedAlmostRightOnTime,
    hoppedPrebook30Early,
    hoppedWalkin11MinsAgo,
  ];
  const { appointments, apptRefToEncounterMap } = getAppointmentsAndMap(visits);

  // 15 min early appt gets to go in first b/c waiting 1 additional minute??
  const expectedOrder: Appointment[] = [
    hoppedWalkin11MinsAgo.appointment,
    hoppedPrebook30Early.appointment,
    postTelemedOne.appointment,
    postTelemedTwo.appointment,
    prebookedAlmostRightOnTime.appointment,
    prebookedRightOnTime.appointment,
    prebooked15MinEarlyAppt.appointment,
    prebooked15MinEarly2.appointment,
    walkin75MinsAgo.appointment,
    walkin11MinsAgo.appointment,
    preBooked17MinEarly.appointment,
    walkinJustNow.appointment,
  ];

  const sorted = sortAppointments(appointments, apptRefToEncounterMap).inOffice.waitingRoom.arrived;
  expect(sorted.length).toBe(expectedOrder.length);
  sorted.forEach((val, idx) => {
    console.log(val.id);
    expect(val.id).toBe(expectedOrder[idx].id);
  });
});

test('ready patients queue', async () => {
  const checkInAppointment = (visit: VisitDetails): VisitDetails => {
    visit.appointment.status = 'checked-in';
    return visit;
  };

  const prebooked15MinEarly = checkInAppointment(makeVisit_Arrived('pre-booked', -15, 3));
  const preBooked17MinEarly = checkInAppointment(makeVisit_Arrived('pre-booked', -17, 10));
  const preBooked10MinEarly = checkInAppointment(makeVisit_Arrived('pre-booked', -10, 5));
  const prebooked15MinEarly2 = checkInAppointment(makeVisit_Arrived('pre-booked', -15, 1));
  const walkinJustNow = checkInAppointment(makeWalkinVisit_Arrived(2));
  const walkin74MinsAgo = checkInAppointment(makeWalkinVisit_Arrived(74));
  const hoppedWalkin74MinsAgo = applyHop(checkInAppointment(makeWalkinVisit_Arrived(74)));
  const walkin75MinsAgo = checkInAppointment(makeWalkinVisit_Arrived(75));
  const prebookedRightOnTime = checkInAppointment(makeVisit_Arrived('pre-booked', 0, 0));
  const prebookedAlmostRightOnTime = checkInAppointment(makeVisit_Arrived('pre-booked', 0, 2));
  const walkin11MinsAgo = checkInAppointment(makeWalkinVisit_Arrived(11));
  const postTelemedRightOnTime = checkInAppointment(makeVisit_Arrived('post-telemed', 0, 0));
  const postTelemedAlmostRightOnTime = checkInAppointment(makeVisit_Arrived('post-telemed', 0, 2));
  await new Promise((resolve) => setTimeout(resolve, 10)); // make sure this appointment is hopped after the first
  const hoppedPreBooked17MinEarly = applyHop(checkInAppointment(makeVisit_Arrived('pre-booked', -17, 10)));

  const visits: VisitDetails[] = [
    prebooked15MinEarly,
    preBooked17MinEarly,
    postTelemedRightOnTime,
    walkinJustNow,
    walkin75MinsAgo,
    walkin74MinsAgo,
    postTelemedAlmostRightOnTime,
    prebookedRightOnTime,
    preBooked10MinEarly,
    walkin11MinsAgo,
    prebooked15MinEarly2,
    prebookedAlmostRightOnTime,
    hoppedWalkin74MinsAgo,
    hoppedPreBooked17MinEarly,
  ];
  const { appointments, apptRefToEncounterMap } = getAppointmentsAndMap(visits);

  // 15 min early appt gets to go in first b/c waiting 1 additional minute??
  const expectedOrder: Appointment[] = [
    hoppedPreBooked17MinEarly.appointment,
    hoppedWalkin74MinsAgo.appointment,
    postTelemedAlmostRightOnTime.appointment,
    postTelemedRightOnTime.appointment,
    prebookedAlmostRightOnTime.appointment,
    prebookedRightOnTime.appointment,
    walkin75MinsAgo.appointment,
    preBooked10MinEarly.appointment,
    walkin74MinsAgo.appointment,
    walkin11MinsAgo.appointment,
    prebooked15MinEarly.appointment,
    prebooked15MinEarly2.appointment,
    preBooked17MinEarly.appointment,
    walkinJustNow.appointment,
  ];

  const sorted = sortAppointments(appointments, apptRefToEncounterMap).inOffice.waitingRoom.ready;
  expect(sorted.length).toBe(expectedOrder.length);
  sorted.forEach((val, idx) => {
    console.log(val.id);
    expect(val.id).toBe(expectedOrder[idx].id);
  });
});

test('intake patients queue', () => {
  const prebooked15MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 7), 'intake', 1);
  const preBooked17MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -17, 10), 'intake', 1);
  const preBooked10MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -10, 5), 'intake', 1);
  const prebooked15MinEarly2 = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 1), 'intake', 0);
  const walkinJustNow = addNewStatusToVisit(makeWalkinVisit_Arrived(2), 'intake', 1);
  const walkin74MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(74), 'intake', 20);
  const walkin75MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(75), 'intake', 15);
  const prebookedRightOnTime = addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 0), 'intake', 0);
  const prebookedAlmostRightOnTime = addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 2), 'intake', 1);
  const postTelemedRightOnTime = addNewStatusToVisit(makeVisit_Arrived('post-telemed', 0, 0), 'intake', 0);
  const postTelemedAlmostRightOnTime = addNewStatusToVisit(makeVisit_Arrived('post-telemed', 0, 2), 'intake', 1);
  const walkin11MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(11), 'intake', 1);

  const visits: VisitDetails[] = [
    prebooked15MinEarly,
    postTelemedRightOnTime,
    walkin11MinsAgo,
    walkin74MinsAgo,
    walkin75MinsAgo,
    preBooked10MinEarly,
    prebookedAlmostRightOnTime,
    prebookedRightOnTime,
    postTelemedAlmostRightOnTime,
    preBooked17MinEarly,
    prebooked15MinEarly2,
    walkinJustNow,
  ];
  const { appointments, apptRefToEncounterMap } = getAppointmentsAndMap(visits);

  // 15 min early appt gets to go in first b/c waiting 1 additional minute??
  const expectedOrder: Appointment[] = [
    walkin75MinsAgo.appointment,
    walkin74MinsAgo.appointment,
    walkin11MinsAgo.appointment,
    preBooked17MinEarly.appointment,
    prebooked15MinEarly.appointment,
    preBooked10MinEarly.appointment,
    prebookedAlmostRightOnTime.appointment,
    postTelemedAlmostRightOnTime.appointment,
    walkinJustNow.appointment,
    prebooked15MinEarly2.appointment,
    postTelemedRightOnTime.appointment,
    prebookedRightOnTime.appointment,
  ];

  const sorted = sortAppointments(appointments, apptRefToEncounterMap).inOffice.inExam.intake;

  expect(sorted.length).toBe(expectedOrder.length);
  sorted.forEach((val, idx) => {
    console.log(val.id);
    expect(val.id).toBe(expectedOrder[idx].id);
  });
});

test('ready for provider patients queue', async () => {
  const prebooked15MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 7), 'ready for provider', 1);
  const preBooked17MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -17, 10), 'ready for provider', 1);
  const preBooked10MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -10, 5), 'ready for provider', 1);
  const prebooked15MinEarly2 = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 1), 'ready for provider', 0);
  const preBooked5MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -5, 5), 'ready for provider', 1);
  const walkinJustNow = addNewStatusToVisit(makeWalkinVisit_Arrived(2), 'ready for provider', 1);
  const walkin74MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(74), 'ready for provider', 20);
  const hoppedWalkin74MinsAgo = applyHop(addNewStatusToVisit(makeWalkinVisit_Arrived(74), 'ready for provider', 20));
  const walkin75MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(75), 'ready for provider', 15);
  const prebookedRightOnTime = addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 0), 'ready for provider', 0);
  const prebookedAlmostRightOnTime = addNewStatusToVisit(
    makeVisit_Arrived('pre-booked', 0, 2),
    'ready for provider',
    1
  );
  const postTelemedRightOnTime = addNewStatusToVisit(makeVisit_Arrived('post-telemed', 0, 0), 'ready for provider', 0);
  const postTelemedAlmostRightOnTime = addNewStatusToVisit(
    makeVisit_Arrived('post-telemed', 0, 2),
    'ready for provider',
    1
  );
  const walkin11MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(11), 'ready for provider', 1);
  await new Promise((resolve) => setTimeout(resolve, 10)); // make sure this appointment is hopped after the first
  const hoppedPrebookedRightOnTime = applyHop(
    addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 0), 'ready for provider', 0)
  );

  const visits: VisitDetails[] = [
    postTelemedRightOnTime,
    prebooked15MinEarly,
    walkin11MinsAgo,
    walkin74MinsAgo,
    walkin75MinsAgo,
    preBooked10MinEarly,
    preBooked5MinEarly,
    prebookedAlmostRightOnTime,
    prebookedRightOnTime,
    preBooked17MinEarly,
    prebooked15MinEarly2,
    postTelemedAlmostRightOnTime,
    walkinJustNow,
    hoppedWalkin74MinsAgo,
    hoppedPrebookedRightOnTime,
  ];
  const { appointments, apptRefToEncounterMap } = getAppointmentsAndMap(visits);

  const expectedOrder: Appointment[] = [
    hoppedPrebookedRightOnTime.appointment,
    hoppedWalkin74MinsAgo.appointment,
    postTelemedAlmostRightOnTime.appointment,
    postTelemedRightOnTime.appointment,
    prebookedAlmostRightOnTime.appointment,
    prebookedRightOnTime.appointment,
    preBooked5MinEarly.appointment,
    walkin75MinsAgo.appointment,
    walkin74MinsAgo.appointment,
    walkin11MinsAgo.appointment,
    preBooked17MinEarly.appointment,
    prebooked15MinEarly.appointment,
    preBooked10MinEarly.appointment,
    walkinJustNow.appointment,
    prebooked15MinEarly2.appointment,
  ];

  const sorted = sortAppointments(appointments, apptRefToEncounterMap).inOffice.inExam['ready for provider'];

  expect(sorted.length).toBe(expectedOrder.length);
  sorted.forEach((val, idx) => {
    console.log(val.id);
    expect(val.id).toBe(expectedOrder[idx].id);
  });
});

test('discharged patients queue', () => {
  const prebooked15MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 7), 'discharged', 4);
  const preBooked17MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -17, 10), 'discharged', 2);
  const preBooked10MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -10, 5), 'discharged', 1);
  const prebooked15MinEarly2 = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -15, 1), 'discharged', 0);
  const preBooked5MinEarly = addNewStatusToVisit(makeVisit_Arrived('pre-booked', -5, 5), 'discharged', 2);
  const walkinJustNow = addNewStatusToVisit(makeWalkinVisit_Arrived(2), 'discharged', 1);
  const walkin74MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(74), 'discharged', 20);
  const walkin75MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(75), 'discharged', 15);
  const prebookedRightOnTime = addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 0), 'discharged', 0);
  const prebookedAlmostRightOnTime = addNewStatusToVisit(makeVisit_Arrived('pre-booked', 0, 2), 'discharged', 1);
  const walkin11MinsAgo = addNewStatusToVisit(makeWalkinVisit_Arrived(11), 'discharged', 6);

  const visits: VisitDetails[] = [
    prebooked15MinEarly,
    walkin11MinsAgo,
    walkin74MinsAgo,
    walkin75MinsAgo,
    preBooked10MinEarly,
    preBooked5MinEarly,
    prebookedAlmostRightOnTime,
    prebookedRightOnTime,
    preBooked17MinEarly,
    prebooked15MinEarly2,
    walkinJustNow,
  ];
  const { appointments, apptRefToEncounterMap } = getAppointmentsAndMap(visits);

  const expectedOrder: Appointment[] = [
    preBooked17MinEarly.appointment,
    prebooked15MinEarly.appointment,
    prebooked15MinEarly2.appointment,
    preBooked10MinEarly.appointment,
    preBooked5MinEarly.appointment,
    prebookedAlmostRightOnTime.appointment,
    prebookedRightOnTime.appointment,
    walkin75MinsAgo.appointment,
    walkin74MinsAgo.appointment,
    walkin11MinsAgo.appointment,
    walkinJustNow.appointment,
  ];

  const sorted = sortAppointments(appointments, apptRefToEncounterMap).checkedOut;

  expect(sorted.length).toBe(expectedOrder.length);
  sorted.forEach((val, idx) => {
    console.log(val.id);
    expect(val.id).toBe(expectedOrder[idx].id);
  });
});

test('prebooked patients queue', () => {
  const prebooked15MinOut = makeVisit_Pending('pre-booked', -15);
  const preBooked17MinOut = makeVisit_Pending('pre-booked', -17);
  const prebooked14MinOut = makeVisit_Pending('pre-booked', -14);
  const prebookedRightNow = makeVisit_Pending('pre-booked', 0);
  const prebooked10MinsLate = makeVisit_Pending('pre-booked', 10);
  const prebooked5MinsLate = makeVisit_Pending('pre-booked', 5);
  const posttelemedRightNow = makeVisit_Pending('post-telemed', 0);
  const postTelemed16MinsOut = makeVisit_Pending('post-telemed', -16);
  const postTelemed8MinsLate = makeVisit_Pending('post-telemed', 8);

  const visits: VisitDetails[] = [
    prebooked15MinOut,
    preBooked17MinOut,
    posttelemedRightNow,
    prebooked14MinOut,
    prebookedRightNow,
    postTelemed16MinsOut,
    prebooked10MinsLate,
    postTelemed8MinsLate,
    prebooked5MinsLate,
  ];
  const { appointments, apptRefToEncounterMap } = getAppointmentsAndMap(visits);

  // 15 min early appt gets to go in first b/c waiting 1 additional minute??
  const expectedOrder: Appointment[] = [
    prebooked10MinsLate.appointment,
    postTelemed8MinsLate.appointment,
    prebooked5MinsLate.appointment,
    posttelemedRightNow.appointment, // order doesn't matter between these two
    prebookedRightNow.appointment, // order doesn't matter between these two
    prebooked14MinOut.appointment,
    prebooked15MinOut.appointment,
    postTelemed16MinsOut.appointment,
    preBooked17MinOut.appointment,
  ];

  const sorted = sortAppointments(appointments, apptRefToEncounterMap).prebooked;

  expect(sorted.length).toBe(expectedOrder.length);
  sorted.forEach((val, idx) => {
    console.log(val.id);
    expect(val.id).toBe(expectedOrder[idx].id);
  });
});
