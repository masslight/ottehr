import { Appointment } from 'fhir/r4';
import { DateTime } from 'luxon';
import { VisitStatusHistoryEntry, VisitStatus, getVisitStatusHistory } from './fhirStatusMappingUtils';
import { appointmentTypeForAppointment } from './queueingUtils';

const startTimeOfMostRecentInstanceOfStatus = (
  status: VisitStatus,
  history: VisitStatusHistoryEntry[],
): number | null => {
  const matchedStati = history.filter((item) => {
    if (item.label === status && item.period.start !== undefined) {
      return true;
    }
    return false;
  });

  if (matchedStati.length === 1) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return DateTime.fromISO(matchedStati[0].period.start!).toSeconds();
  } else if (matchedStati.length > 1) {
    const sorted = matchedStati.sort((a1, a2) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return DateTime.fromISO(a1.period.start!).toSeconds() - DateTime.fromISO(a2.period.start!).toSeconds();
    });
    const mostRecent = sorted.pop();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return DateTime.fromISO(mostRecent!.period.start!).toSeconds();
  } else {
    return null;
  }
};

const getLastUnterminatedStatusEntry = (history: VisitStatusHistoryEntry[]): VisitStatusHistoryEntry | null => {
  const matchedStati = history.filter((item) => {
    if (item.period.end === undefined) {
      return true;
    }
    return false;
  });

  if (matchedStati.length === 1) {
    return matchedStati[0];
  } else if (matchedStati.length > 1) {
    const sorted = matchedStati.sort((a1, a2) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return DateTime.fromISO(a1.period.start!).toSeconds() - DateTime.fromISO(a2.period.start!).toSeconds();
    });
    return sorted[sorted.length - 1];
  } else {
    return null;
  }
};

// returns the arrived time as an epoch time in seconds
const getArrivedTime = (statusHistory: VisitStatusHistoryEntry[], appointment: Appointment): number | null => {
  const appointmentType = appointmentTypeForAppointment(appointment);
  if (appointmentType === 'walk-in' && appointment.start) {
    const startTime = DateTime.fromISO(appointment.start ?? '');
    if (startTime.isValid) {
      return startTime.toSeconds();
    }
  }

  let arrivedTime = startTimeOfMostRecentInstanceOfStatus('arrived', statusHistory);

  if (arrivedTime === null) {
    arrivedTime = startTimeOfMostRecentInstanceOfStatus('ready', statusHistory);
  }
  if (arrivedTime === null) {
    arrivedTime = startTimeOfMostRecentInstanceOfStatus('intake', statusHistory);
  }

  return arrivedTime;
};

const getWaitingTimeEndRange = (statusHistory: VisitStatusHistoryEntry[]): number => {
  let stopTime = startTimeOfMostRecentInstanceOfStatus('ready for discharge', statusHistory);
  if (stopTime === null) {
    stopTime = startTimeOfMostRecentInstanceOfStatus('checked out', statusHistory);
  }
  if (stopTime == null) {
    const lastUnterminated = getLastUnterminatedStatusEntry(statusHistory);
    if (lastUnterminated && lastUnterminated.label === 'canceled') {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      stopTime = DateTime.fromISO(lastUnterminated.period.start!).toSeconds();
    }
  }
  if (stopTime === null) {
    return DateTime.now().toSeconds();
  }
  return stopTime;
};

export const getWaitingTimeForAppointment = (appointment: Appointment): number => {
  const statusHistory = getVisitStatusHistory(appointment);
  const arrivedTime = getArrivedTime(statusHistory, appointment);

  if (arrivedTime === null) {
    return 0;
  }

  const stopTime = getWaitingTimeEndRange(statusHistory);

  return Math.round((stopTime - arrivedTime) / 60);
};

export const getTimeSpentInCurrentStatus = (appointment: Appointment): number => {
  const statusHistory = getVisitStatusHistory(appointment);
  const current = getLastUnterminatedStatusEntry(statusHistory);
  if (!current) {
    return 0;
  }
  return (
    -1.0 *
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (Math.round((DateTime.fromISO(current.period.start!).diffNow('minutes').minutes + Number.EPSILON) * 100) / 100)
  );
};
