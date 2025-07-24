import { Appointment, Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { appointmentTypeForAppointment, getVisitStatus } from 'utils';
import { getTimeSpentInCurrentStatus, getWaitingTimeForAppointment } from './waitTimeUtils';

const ARRIVED_PREBOOKED_EARLY_ARRIVAL_LIMIT = 15;
const READY_PREBOOKED_EARLY_ARRIVAL_LIMIT = 10;
const R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT = 5;
const READY_WALKIN_MAX_WAIT_THRESHOLD = 75;
// const R4P_WALKIN_MAX_WAIT_THRESHOLD = 75;

const checkForHop = (app1: Appointment, app2: Appointment): number | undefined => {
  const appt1Hopped = app1.meta?.tag?.find((tag) => tag.system === 'hop-queue')?.code;
  const appt2Hopped = app2.meta?.tag?.find((tag) => tag.system === 'hop-queue')?.code;

  if (appt1Hopped && appt2Hopped) {
    return DateTime.fromISO(appt2Hopped).diff(DateTime.fromISO(appt1Hopped), 'milliseconds').milliseconds;
  }

  if (appt1Hopped && !appt2Hopped) {
    return -1;
  }

  if (appt2Hopped && !appt1Hopped) {
    return 1;
  }

  return;
};

type WaitingRoomKey = 'arrived' | 'ready';
type InExamKey = 'intake' | 'ready for provider' | 'provider';
type VisitDetails = { appointment: Appointment; encounter: Encounter };
type AppointmentComparator = (visit1: VisitDetails, visit2: VisitDetails) => number;

interface AppointmentQueue {
  list: VisitDetails[];
  comparator: AppointmentComparator;
}

interface AppointmentQueues {
  prebooked: AppointmentQueue;
  inOffice: {
    waitingRoom: Record<WaitingRoomKey, AppointmentQueue>;
    inExam: Record<InExamKey, AppointmentQueue>;
  };
  checkedOut: AppointmentQueue;
  canceled: AppointmentQueue;
}

export interface SortedAppointmentQueues {
  prebooked: Appointment[];
  inOffice: {
    waitingRoom: Record<WaitingRoomKey, Appointment[]>;
    inExam: Record<InExamKey, Appointment[]>;
  };
  checkedOut: Appointment[];
  canceled: Appointment[];
}

const prebookedSorter = (visit1: VisitDetails, visit2: VisitDetails): number => {
  const app1 = visit1.appointment;
  const app2 = visit2.appointment;
  const start1 = DateTime.fromISO(app1.start ?? '');
  const start2 = DateTime.fromISO(app2.start ?? '');

  if (!start1.isValid && !start2.isValid) {
    return 0;
  }
  if (!start1.isValid) {
    return -1;
  }
  if (!start2.isValid) {
    return 1;
  }
  if (start1.equals(start2)) {
    return getWaitingTimeForAppointment(visit2.encounter) - getWaitingTimeForAppointment(visit1.encounter);
  }
  return start1 < start2 ? -1 : 1;
};

const arrivedSorter = (visit1: VisitDetails, visit2: VisitDetails): number => {
  const app1 = visit1.appointment;
  const app2 = visit2.appointment;
  const app1Type = appointmentTypeForAppointment(app1);
  const app2Type = appointmentTypeForAppointment(app2);

  const hopped = checkForHop(app1, app2);
  if (hopped) return hopped;

  if (app1Type === 'post-telemed' && app2Type === 'post-telemed') {
    return prebookedSorter(visit1, visit2);
  }

  if (app1Type === 'post-telemed' && app2Type !== 'post-telemed') {
    return -1;
  }

  if (app2Type === 'post-telemed' && app1Type !== 'post-telemed') {
    return 1;
  }

  if (app1Type === 'pre-booked' && app2Type === 'pre-booked') {
    return prebookedSorter(visit1, visit2);
  }
  if (app1Type === 'pre-booked') {
    const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
    if (minutesUntilApptOneStart <= ARRIVED_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return -1;
    }
  }
  if (app2Type === 'pre-booked') {
    const minutesUntilApptTwoStart = DateTime.fromISO(app2.start!).diffNow('minutes').minutes;
    if (minutesUntilApptTwoStart <= ARRIVED_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return 1;
    }
  }
  return getWaitingTimeForAppointment(visit2.encounter) - getWaitingTimeForAppointment(visit1.encounter);
};

const readySorter = (visit1: VisitDetails, visit2: VisitDetails): number => {
  const app1 = visit1.appointment;
  const app2 = visit2.appointment;
  const app1Type = appointmentTypeForAppointment(app1);
  const app2Type = appointmentTypeForAppointment(app2);

  const hopped = checkForHop(app1, app2);
  if (hopped) return hopped;

  if (app1Type === 'post-telemed' && app2Type === 'post-telemed') {
    return prebookedSorter(visit1, visit2);
  }

  if (app1Type === 'post-telemed' && app2Type !== 'post-telemed') {
    return -1;
  }

  if (app2Type === 'post-telemed' && app1Type !== 'post-telemed') {
    return 1;
  }

  if (app1Type === 'pre-booked' && app2Type === 'pre-booked') {
    return prebookedSorter(visit1, visit2);
  }
  if (app1Type === 'pre-booked') {
    const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
    if (minutesUntilApptOneStart <= 0) {
      return -1;
    }
  }
  if (app2Type === 'pre-booked') {
    const minutesUntilApptTwoStart = DateTime.fromISO(app2.start!).diffNow('minutes').minutes;
    if (minutesUntilApptTwoStart <= 0) {
      return 1;
    }
  }

  const app1WaitingTime = getWaitingTimeForAppointment(visit1.encounter);
  if (app1Type === 'walk-in' && app2Type === 'pre-booked' && app1WaitingTime >= READY_WALKIN_MAX_WAIT_THRESHOLD) {
    return -1;
  }
  const app2WaitingTime = getWaitingTimeForAppointment(visit2.encounter);
  if (app2Type === 'walk-in' && app1Type === 'pre-booked' && app2WaitingTime >= READY_WALKIN_MAX_WAIT_THRESHOLD) {
    return 1;
  }

  if (app1Type === 'pre-booked') {
    const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
    if (minutesUntilApptOneStart <= READY_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return -1;
    }
  }
  if (app2Type === 'pre-booked') {
    const minutesUntilApptTwoStart = DateTime.fromISO(app2.start!).diffNow('minutes').minutes;
    if (minutesUntilApptTwoStart <= READY_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return 1;
    }
  }
  return app2WaitingTime - app1WaitingTime;
};

const intakeSorter = (visit1: VisitDetails, visit2: VisitDetails): number => {
  const app1WaitingTime = getWaitingTimeForAppointment(visit1.encounter);
  const app2WaitingTime = getWaitingTimeForAppointment(visit2.encounter);

  return app2WaitingTime - app1WaitingTime;
};

const r4ProviderSorter = (visit1: VisitDetails, visit2: VisitDetails): number => {
  const app1 = visit1.appointment;
  const app2 = visit2.appointment;
  const app1Type = appointmentTypeForAppointment(app1);
  const app2Type = appointmentTypeForAppointment(app2);
  const app1WaitingTime = getWaitingTimeForAppointment(visit1.encounter);
  const app2WaitingTime = getWaitingTimeForAppointment(visit2.encounter);

  const hopped = checkForHop(app1, app2);
  if (hopped) return hopped;

  if (app1Type === 'post-telemed' && app2Type === 'post-telemed') {
    return prebookedSorter(visit1, visit2);
  }

  if (app1Type === 'post-telemed' && app2Type !== 'post-telemed') {
    return -1;
  }

  if (app2Type === 'post-telemed' && app1Type !== 'post-telemed') {
    return 1;
  }
  /*
    Walk-in, has waiting time of 75+ mins 
    Pre-booked, current time + 5mins >= appointment time
    Walk-ins / Pre-booked, current time + 5mins < appointment time: descending order by waiting time
    */
  if (app1Type === 'walk-in' && app2Type === 'walk-in') {
    return app2WaitingTime - app1WaitingTime;
  }

  const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
  const minutesUntilApptTwoStart = DateTime.fromISO(app2.start!).diffNow('minutes').minutes;

  // if (app1Type === 'walk-in' && app1WaitingTime >= R4P_WALKIN_MAX_WAIT_THRESHOLD) {
  //   return -1;
  // }
  // if (app2Type === 'walk-in' && app2WaitingTime >= R4P_WALKIN_MAX_WAIT_THRESHOLD) {
  //   return 1;
  // }

  if (
    app1Type === 'pre-booked' &&
    minutesUntilApptOneStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT &&
    app2Type === 'pre-booked' &&
    minutesUntilApptTwoStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT
  ) {
    return prebookedSorter(visit1, visit2);
  }
  if (app1Type === 'pre-booked') {
    if (minutesUntilApptOneStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return -1;
    }
  }
  if (app2Type === 'pre-booked') {
    if (minutesUntilApptTwoStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return 1;
    }
  }
  return app2WaitingTime - app1WaitingTime;
};

const getArrivalTime = (encounter: Encounter): number => {
  const history = encounter.statusHistory ?? [];
  const arrived = history.find((h) => h.status === 'arrived');
  if (!arrived || !arrived.period?.start) {
    return Infinity;
  }
  return Date.parse(arrived.period.start);
};

function checkedOutSorter(visit1: VisitDetails, visit2: VisitDetails): number {
  const app1 = visit1.appointment;
  const app2 = visit2.appointment;
  const app1Type = appointmentTypeForAppointment(app1);
  const app2Type = appointmentTypeForAppointment(app2);

  const visit1IsPre = app1Type === 'pre-booked' ? 0 : 1;
  const visit2IsPre = app2Type === 'pre-booked' ? 0 : 1;

  if (visit1IsPre !== visit2IsPre) {
    return visit1IsPre - visit2IsPre;
  }

  const getStatusPriority = (visit: VisitDetails): number => {
    const { appointment, encounter } = visit;
    const status = getVisitStatus(appointment, encounter);
    if (status === 'discharged') return 0;
    if (status === 'completed') return 1;
    return 2;
  };

  const visit1StatusPriority = getStatusPriority(visit1);
  const visit2StatusPriority = getStatusPriority(visit2);

  if (visit1StatusPriority !== visit2StatusPriority) {
    return visit1StatusPriority - visit2StatusPriority;
  }

  if (visit1IsPre === 0) {
    const app1Start = Date.parse(app1.start ?? '');
    const app2Start = Date.parse(app2.start ?? '');
    return app2Start - app1Start;
  }

  const app1Arrived = getArrivalTime(visit1.encounter);
  const app2Arrived = getArrivalTime(visit2.encounter);
  return app1Arrived - app2Arrived;
}

const currentStatusSorter = (visit1: VisitDetails, visit2: VisitDetails): number => {
  const statusDiff = getTimeSpentInCurrentStatus(visit2.encounter) - getTimeSpentInCurrentStatus(visit1.encounter);
  if (statusDiff === 0) {
    return getWaitingTimeForAppointment(visit2.encounter) - getWaitingTimeForAppointment(visit1.encounter);
  }
  return statusDiff;
};

const currentStatusReversedSorter = (visit1: VisitDetails, visit2: VisitDetails): number => {
  const statusDiff = getTimeSpentInCurrentStatus(visit1.encounter) - getTimeSpentInCurrentStatus(visit2.encounter);
  if (statusDiff === 0) {
    return getWaitingTimeForAppointment(visit1.encounter) - getWaitingTimeForAppointment(visit2.encounter);
  }
  return statusDiff;
};

const evalQueue = (queue: AppointmentQueue): Appointment[] => {
  return queue.list.sort(queue.comparator).map((visit) => visit.appointment);
};

class QueueBuilder {
  queues: AppointmentQueues;
  constructor() {
    const emptyQueues: AppointmentQueues = {
      prebooked: { list: [], comparator: prebookedSorter },
      inOffice: {
        waitingRoom: {
          arrived: { list: [], comparator: arrivedSorter },
          ready: { list: [], comparator: readySorter },
        },
        inExam: {
          intake: { list: [], comparator: intakeSorter },
          'ready for provider': { list: [], comparator: r4ProviderSorter },
          provider: { list: [], comparator: currentStatusSorter },
        },
      },
      checkedOut: { list: [], comparator: checkedOutSorter },
      canceled: { list: [], comparator: currentStatusReversedSorter },
    };
    this.queues = emptyQueues;
  }

  private insertNew(appointment: Appointment, encounter: Encounter, queue: AppointmentQueue): void {
    queue.list.push({ appointment, encounter });
  }

  sortAppointments(
    appointments: Appointment[],
    apptRefToEncounterMap: Record<string, Encounter>
  ): SortedAppointmentQueues {
    appointments.forEach((appointment) => {
      const encounter = apptRefToEncounterMap[`Appointment/${appointment.id}`];
      if (encounter && appointment) {
        const status = getVisitStatus(appointment, encounter);

        if (status === 'pending') {
          this.insertNew(appointment, encounter, this.queues.prebooked);
        } else if (status === 'arrived') {
          this.insertNew(appointment, encounter, this.queues.inOffice.waitingRoom.arrived);
        } else if (status === 'ready') {
          this.insertNew(appointment, encounter, this.queues.inOffice.waitingRoom.ready);
        } else if (status === 'intake') {
          this.insertNew(appointment, encounter, this.queues.inOffice.inExam.intake);
        } else if (status === 'ready for provider') {
          this.insertNew(appointment, encounter, this.queues.inOffice.inExam['ready for provider']);
        } else if (status === 'provider') {
          this.insertNew(appointment, encounter, this.queues.inOffice.inExam.provider);
        } else if (status === 'cancelled' || status === 'no show') {
          this.insertNew(appointment, encounter, this.queues.canceled);
        } else if (status === 'completed' || status === 'discharged') {
          this.insertNew(appointment, encounter, this.queues.checkedOut);
        }
      }
    });
    return {
      prebooked: evalQueue(this.queues.prebooked),
      inOffice: {
        waitingRoom: {
          arrived: evalQueue(this.queues.inOffice.waitingRoom.arrived),
          ready: evalQueue(this.queues.inOffice.waitingRoom.ready),
        },
        inExam: {
          intake: evalQueue(this.queues.inOffice.inExam.intake),
          'ready for provider': evalQueue(this.queues.inOffice.inExam['ready for provider']),
          provider: evalQueue(this.queues.inOffice.inExam.provider),
        },
      },
      checkedOut: evalQueue(this.queues.checkedOut),
      canceled: evalQueue(this.queues.canceled),
    };
  }
}

export const sortAppointments = (
  appointments: Appointment[],
  apptRefToEncounterMap: Record<string, Encounter>
): SortedAppointmentQueues => {
  const queueBuilder = new QueueBuilder();
  return queueBuilder.sortAppointments(appointments, apptRefToEncounterMap);
};
