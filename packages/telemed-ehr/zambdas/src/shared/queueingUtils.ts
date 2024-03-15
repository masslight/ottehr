import { Appointment } from 'fhir/r4';
import { AppointmentType } from '../types';
import { DateTime } from 'luxon';
import { getTimeSpentInCurrentStatus, getWaitingTimeForAppointment } from './waitTimeUtils';
import { getStatusLabelForAppointmentAndEncounter } from './fhirStatusMappingUtils';

const FHIR_APPOINTMENT_TYPE_MAP: Record<string, AppointmentType> = {
  walkin: 'walk-in',
  prebook: 'pre-booked',
};

const ARRIVED_PREBOOKED_EARLY_ARRIVAL_LIMIT = 15;
const READY_PREBOOKED_EARLY_ARRIVAL_LIMIT = 10;
const R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT = 5;
const READY_WALKIN_MAX_WAIT_THRESHOLD = 75;
const R4P_WALKIN_MAX_WAIT_THRESHOLD = 75;

export const appointmentTypeForAppointment = (appointment: Appointment): AppointmentType => {
  // might as well default to walkin here
  return appointment.appointmentType?.text ? FHIR_APPOINTMENT_TYPE_MAP[appointment.appointmentType?.text] : 'walk-in';
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

  if (app1Type === 'pre-booked' && app2Type === 'pre-booked') {
    return prebookedSorter(app1, app2);
  }
  if (app1Type === 'pre-booked') {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
    if (minutesUntilApptOneStart <= ARRIVED_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return -1;
    }
  }
  if (app2Type === 'pre-booked') {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

  if (app1Type === 'pre-booked' && app2Type === 'pre-booked') {
    return prebookedSorter(app1, app2);
  }
  if (app1Type === 'pre-booked') {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
    if (minutesUntilApptOneStart <= 0) {
      return -1;
    }
  }
  if (app2Type === 'pre-booked') {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const minutesUntilApptTwoStart = DateTime.fromISO(app2.start!).diffNow('minutes').minutes;
    if (minutesUntilApptTwoStart <= 0) {
      return 1;
    }
  }

  const app1WaitingTime = getWaitingTimeForAppointment(app1);
  if (app1Type === 'walk-in' && app2Type === 'pre-booked' && app1WaitingTime >= READY_WALKIN_MAX_WAIT_THRESHOLD) {
    return -1;
  }
  const app2WaitingTime = getWaitingTimeForAppointment(app2);
  if (app2Type === 'walk-in' && app1Type === 'pre-booked' && app2WaitingTime >= READY_WALKIN_MAX_WAIT_THRESHOLD) {
    return 1;
  }

  if (app1Type === 'pre-booked') {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
    if (minutesUntilApptOneStart <= READY_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return -1;
    }
  }
  if (app2Type === 'pre-booked') {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
  /*
    Walk-in, has waiting time of 75+ mins 
    Pre-booked, current time + 5mins >= appointment time
    Walk-ins / Pre-booked, current time + 5mins < appointment time: descending order by waiting time
    */
  if (app1Type === 'walk-in' && app2Type === 'walk-in') {
    return app2WaitingTime - app1WaitingTime;
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const minutesUntilApptOneStart = DateTime.fromISO(app1.start!).diffNow('minutes').minutes;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const minutesUntilApptTwoStart = DateTime.fromISO(app2.start!).diffNow('minutes').minutes;

  if (app1Type === 'walk-in' && app1WaitingTime >= R4P_WALKIN_MAX_WAIT_THRESHOLD) {
    return -1;
  }
  if (app2Type === 'walk-in' && app2WaitingTime >= R4P_WALKIN_MAX_WAIT_THRESHOLD) {
    return 1;
  }

  if (
    app1Type === 'pre-booked' &&
    minutesUntilApptOneStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT &&
    app2Type === 'pre-booked' &&
    minutesUntilApptTwoStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT
  ) {
    return prebookedSorter(app1, app2);
  }
  if (app1Type === 'pre-booked') {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (minutesUntilApptOneStart <= R4P_PREBOOKED_EARLY_ARRIVAL_LIMIT) {
      return -1;
    }
  }
  if (app2Type === 'pre-booked') {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

      if (status === 'pending' && appointmentType === 'pre-booked') {
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
