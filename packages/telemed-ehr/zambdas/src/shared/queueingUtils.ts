import { Appointment } from 'fhir/r4';
import { DateTime } from 'luxon';
import { getTimeSpentInCurrentStatus, getWaitingTimeForAppointment } from './waitTimeUtils';
import { getStatusLabelForAppointmentAndEncounter } from './fhirStatusMappingUtils';
import { AppointmentType } from 'ehr-utils';

const FHIR_APPOINTMENT_TYPE_MAP: Record<string, AppointmentType> = {
  now: 'now',
  prebook: 'prebook',
};

const ARRIVED_PREBOOKED_EARLY_ARRIVAL_LIMIT = 15;
const READY_PREBOOKED_EARLY_ARRIVAL_LIMIT = 10;
const R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT = 5;
const READY_WALKIN_MAX_WAIT_THRESHOLD = 75;
// const R4P_WALKIN_MAX_WAIT_THRESHOLD = 75;

export const appointmentTypeForAppointment = (appointment: Appointment): AppointmentType | undefined => {
  // might as well default to walkin here
  // console.log('FHIR_APPOINTMENT_TYPE_MAP', FHIR_APPOINTMENT_TYPE_MAP, appointment.appointmentType?.text);
  return appointment.appointmentType?.text ? FHIR_APPOINTMENT_TYPE_MAP[appointment.appointmentType?.text] : undefined;
};

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
type InExamKey = 'intake' | 'ready for provider' | 'provider' | 'ready for discharge';
type AppointmentComparator = (app1: Appointment, app2: Appointment) => number;

interface AppointmentQueue {
  list: Appointment[];
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

const prebookedSorter = (app1: Appointment, app2: Appointment): number => {
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
    return getWaitingTimeForAppointment(app2) - getWaitingTimeForAppointment(app1);
  }
  return start1 < start2 ? -1 : 1;
};

const arrivedSorter = (app1: Appointment, app2: Appointment): number => {
  const app1Type = appointmentTypeForAppointment(app1);
  const app2Type = appointmentTypeForAppointment(app2);

  const hopped = checkForHop(app1, app2);
  if (hopped) return hopped;

  if (app1Type === 'prebook' && app2Type === 'prebook') {
    return prebookedSorter(app1, app2);
  }
  if (app1Type === 'prebook') {
    const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
    if (minutesUntilApptOneStart <= ARRIVED_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return -1;
    }
  }
  if (app2Type === 'prebook') {
    const minutesUntilApptTwoStart = DateTime.fromISO(app2.start!).diffNow('minutes').minutes;
    if (minutesUntilApptTwoStart <= ARRIVED_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return 1;
    }
  }
  return getWaitingTimeForAppointment(app2) - getWaitingTimeForAppointment(app1);
};

const readySorter = (app1: Appointment, app2: Appointment): number => {
  const app1Type = appointmentTypeForAppointment(app1);
  const app2Type = appointmentTypeForAppointment(app2);

  const hopped = checkForHop(app1, app2);
  if (hopped) return hopped;
  if (app1Type === 'prebook' && app2Type === 'prebook') {
    return prebookedSorter(app1, app2);
  }
  if (app1Type === 'prebook') {
    const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
    if (minutesUntilApptOneStart <= 0) {
      return -1;
    }
  }
  if (app2Type === 'prebook') {
    const minutesUntilApptTwoStart = DateTime.fromISO(app2.start!).diffNow('minutes').minutes;
    if (minutesUntilApptTwoStart <= 0) {
      return 1;
    }
  }

  const app1WaitingTime = getWaitingTimeForAppointment(app1);
  if (app1Type === 'now' && app2Type === 'prebook' && app1WaitingTime >= READY_WALKIN_MAX_WAIT_THRESHOLD) {
    return -1;
  }
  const app2WaitingTime = getWaitingTimeForAppointment(app2);
  if (app2Type === 'now' && app1Type === 'prebook' && app2WaitingTime >= READY_WALKIN_MAX_WAIT_THRESHOLD) {
    return 1;
  }

  if (app1Type === 'prebook') {
    const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
    if (minutesUntilApptOneStart <= READY_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return -1;
    }
  }
  if (app2Type === 'prebook') {
    const minutesUntilApptTwoStart = DateTime.fromISO(app2.start!).diffNow('minutes').minutes;
    if (minutesUntilApptTwoStart <= READY_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return 1;
    }
  }
  return app2WaitingTime - app1WaitingTime;
};

const intakeSorter = (app1: Appointment, app2: Appointment): number => {
  const app1WaitingTime = getWaitingTimeForAppointment(app1);
  const app2WaitingTime = getWaitingTimeForAppointment(app2);

  return app2WaitingTime - app1WaitingTime;
};

const r4ProviderSorter = (app1: Appointment, app2: Appointment): number => {
  const app1Type = appointmentTypeForAppointment(app1);
  const app2Type = appointmentTypeForAppointment(app2);
  const app1WaitingTime = getWaitingTimeForAppointment(app1);
  const app2WaitingTime = getWaitingTimeForAppointment(app2);

  const hopped = checkForHop(app1, app2);
  if (hopped) return hopped;
  /*
    now, has waiting time of 75+ mins 
    prebook, current time + 5mins >= appointment time
    nows / prebook, current time + 5mins < appointment time: descending order by waiting time
    */
  if (app1Type === 'now' && app2Type === 'now') {
    return app2WaitingTime - app1WaitingTime;
  }

  const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
  const minutesUntilApptTwoStart = DateTime.fromISO(app2.start!).diffNow('minutes').minutes;

  // if (app1Type === 'now' && app1WaitingTime >= R4P_WALKIN_MAX_WAIT_THRESHOLD) {
  //   return -1;
  // }
  // if (app2Type === 'now' && app2WaitingTime >= R4P_WALKIN_MAX_WAIT_THRESHOLD) {
  //   return 1;
  // }

  if (
    app1Type === 'prebook' &&
    minutesUntilApptOneStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT &&
    app2Type === 'prebook' &&
    minutesUntilApptTwoStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT
  ) {
    return prebookedSorter(app1, app2);
  }
  if (app1Type === 'prebook') {
    if (minutesUntilApptOneStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return -1;
    }
  }
  if (app2Type === 'prebook') {
    if (minutesUntilApptTwoStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return 1;
    }
  }
  return app2WaitingTime - app1WaitingTime;
};

const currentStatusSorter = (app1: Appointment, app2: Appointment): number => {
  const statusDiff = getTimeSpentInCurrentStatus(app2) - getTimeSpentInCurrentStatus(app1);
  if (statusDiff === 0) {
    return getWaitingTimeForAppointment(app2) - getWaitingTimeForAppointment(app1);
  }
  return statusDiff;
};

const currentStatusReversedSorter = (app1: Appointment, app2: Appointment): number => {
  const statusDiff = getTimeSpentInCurrentStatus(app1) - getTimeSpentInCurrentStatus(app2);
  if (statusDiff === 0) {
    return getWaitingTimeForAppointment(app1) - getWaitingTimeForAppointment(app2);
  }
  return statusDiff;
};

const evalQueue = (queue: AppointmentQueue): Appointment[] => {
  return queue.list.sort(queue.comparator);
};

class QueueBuilder {
  queues: AppointmentQueues;
  env: string;
  constructor(env: string) {
    this.env = env;
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
          'ready for discharge': { list: [], comparator: currentStatusSorter },
        },
      },
      checkedOut: { list: [], comparator: currentStatusReversedSorter },
      canceled: { list: [], comparator: currentStatusReversedSorter },
    };
    this.queues = emptyQueues;
  }

  private insertNew(appointment: Appointment, queue: AppointmentQueue): void {
    queue.list.push(appointment);
  }

  sortAppointments(appointments: Appointment[]): SortedAppointmentQueues {
    appointments.forEach((appointment) => {
      const status = getStatusLabelForAppointmentAndEncounter(appointment);
      const appointmentType = appointmentTypeForAppointment(appointment);
      if (status === 'pending') {
        this.insertNew(appointment, this.queues.prebooked);
      } else if (status === 'arrived') {
        this.insertNew(appointment, this.queues.inOffice.waitingRoom.arrived);
      } else if (status === 'ready') {
        this.insertNew(appointment, this.queues.inOffice.waitingRoom.ready);
      } else if (status === 'intake') {
        this.insertNew(appointment, this.queues.inOffice.inExam.intake);
      } else if (status === 'ready for provider') {
        this.insertNew(appointment, this.queues.inOffice.inExam['ready for provider']);
      } else if (status === 'provider') {
        this.insertNew(appointment, this.queues.inOffice.inExam.provider);
      } else if (status === 'ready for discharge') {
        this.insertNew(appointment, this.queues.inOffice.inExam['ready for discharge']);
      } else if (status === 'canceled' || status === 'no show') {
        this.insertNew(appointment, this.queues.canceled);
      } else if (status === 'checked out') {
        this.insertNew(appointment, this.queues.checkedOut);
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
          'ready for discharge': evalQueue(this.queues.inOffice.inExam['ready for discharge']),
        },
      },
      checkedOut: evalQueue(this.queues.checkedOut),
      canceled: evalQueue(this.queues.canceled),
    };
  }
}

export const sortAppointments = (appointments: Appointment[], env: string): SortedAppointmentQueues => {
  const queueBuilder = new QueueBuilder(env);
  return queueBuilder.sortAppointments(appointments);
};
