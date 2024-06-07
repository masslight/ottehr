import { Appointment } from 'fhir/r4';
import { DateTime } from 'luxon';
import { UCAppointmentInformation, VisitStatusHistoryEntry } from 'ehr-utils';

export const getStatiForVisitTimeCalculation = (
  statuses: VisitStatusHistoryEntry[],
  appointmentStart: string
): VisitStatusHistoryEntry[] => {
  return statuses?.filter(
    (statusEvent: VisitStatusHistoryEntry) =>
      (statusEvent.label !== 'pending' && statusEvent.label !== 'ready for discharge') ||
      (statusEvent.period.end &&
        DateTime.fromISO(statusEvent.period.end).diff(DateTime.fromISO(appointmentStart), 'minutes').minutes >= 0)
  );
};

export const getDurationOfStatus = (
  statusEntry: VisitStatusHistoryEntry,
  appointment: UCAppointmentInformation | Appointment,
  visitStatusHistory: VisitStatusHistoryEntry[],
  dateTimeNow: DateTime
): number => {
  if (!appointment.start) {
    return 0;
  }

  if (statusEntry.label === 'pending') {
    if (statusEntry.period.end) {
      // if the appointment status is not currently pending, the duration is the difference
      // between the end of the status period and the start of the appointment time
      return DateTime.fromISO(statusEntry.period.end).diff(DateTime.fromISO(appointment.start), 'minutes').minutes;
    } else if (statusEntry.period.start) {
      // otherwise, the pending time is the difference between the start of the
      // appointment time and the current time.
      return dateTimeNow.diff(DateTime.fromISO(appointment.start), 'minutes').minutes;
    }
  }

  if (statusEntry.period.start && statusEntry.period.end) {
    return DateTime.fromISO(statusEntry.period.end).diff(DateTime.fromISO(statusEntry.period.start), 'minutes').minutes;
  } else if (statusEntry.period.start) {
    const stopCountingForStatus = ['canceled', 'no show', 'checked out'];
    // stop counting once appointments move to the 'completed' tab.
    if (stopCountingForStatus.includes(statusEntry.label)) {
      // if the appointment status is one of `stopCountingForStatus`, the
      // duration is the difference between start of the current status and
      // the end of the previous status
      const prevStatusHistoryIdx = visitStatusHistory.length - 2;
      const prevEntry = visitStatusHistory[prevStatusHistoryIdx];
      if (prevEntry === undefined) {
        return 0;
      }
      return DateTime.fromISO(statusEntry.period.start).diff(DateTime.fromISO(prevEntry.period.end ?? ''), 'minutes')
        .minutes;
    } else {
      // otherwise, the duration is the difference betweeen now and the start of the status entry
      return dateTimeNow.diff(DateTime.fromISO(statusEntry.period.start), 'minutes').minutes;
    }
  } else {
    return 0;
  }
};

export const getVisitTotalTime = (
  appointment: UCAppointmentInformation | Appointment,
  visitStatusHistory: VisitStatusHistoryEntry[],
  dateTimeNow: DateTime
): number => {
  if (appointment.start) {
    // console.log('appointment', appointment.id);
    return getStatiForVisitTimeCalculation(visitStatusHistory, appointment.start).reduce(
      (accumulator, statusTemp) =>
        accumulator + getDurationOfStatus(statusTemp, appointment, visitStatusHistory, dateTimeNow),
      0
    );
  }
  return 0;
};

export const formatMinutes = (minutes: number): string => {
  return minutes.toLocaleString('en', { maximumFractionDigits: 0 });
};
