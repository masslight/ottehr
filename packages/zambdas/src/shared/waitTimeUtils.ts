import { Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getVisitStatusHistory, VisitStatusHistoryEntry, VisitStatusLabel } from 'utils';

const startTimeOfMostRecentInstanceOfStatus = (
  status: VisitStatusLabel,
  statusHistory: VisitStatusHistoryEntry[]
): number | null => {
  const matchedStati = statusHistory.filter((item) => {
    if (item.status === status && item.period.start !== undefined) {
      return true;
    }
    return false;
  });
  if (matchedStati.length === 1) {
    return DateTime.fromISO(matchedStati[0].period.start!).toSeconds();
  } else if (matchedStati.length > 1) {
    const sorted = matchedStati.sort((a1, a2) => {
      return DateTime.fromISO(a1.period.start!).toSeconds() - DateTime.fromISO(a2.period.start!).toSeconds();
    });
    const mostRecent = sorted.pop();
    return DateTime.fromISO(mostRecent!.period.start!).toSeconds();
  } else {
    return null;
  }
};

const getLastUnterminatedStatusEntry = (statusHistory: VisitStatusHistoryEntry[]): VisitStatusHistoryEntry | null => {
  const matchedStati = statusHistory.filter((item) => {
    if (item.period.end === undefined) {
      return true;
    }
    return false;
  });

  if (matchedStati.length === 1) {
    return matchedStati[0];
  } else if (matchedStati.length > 1) {
    const sorted = matchedStati.sort((a1, a2) => {
      return DateTime.fromISO(a1.period.start!).toSeconds() - DateTime.fromISO(a2.period.start!).toSeconds();
    });
    return sorted[sorted.length - 1];
  } else {
    return null;
  }
};

// returns the arrived time as an epoch time in seconds
const getArrivedTime = (statusHistory: VisitStatusHistoryEntry[]): number | null => {
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
    stopTime = startTimeOfMostRecentInstanceOfStatus('completed', statusHistory);
  }
  if (stopTime == null) {
    const lastUnterminated = getLastUnterminatedStatusEntry(statusHistory);
    if (lastUnterminated && lastUnterminated.status === 'cancelled') {
      stopTime = DateTime.fromISO(lastUnterminated.period.start!).toSeconds();
    }
  }
  if (stopTime === null) {
    return DateTime.now().toSeconds();
  }
  return stopTime;
};

export const getWaitingTimeForAppointment = (encounter: Encounter): number => {
  const statusHistory = getVisitStatusHistory(encounter);
  const arrivedTime = getArrivedTime(statusHistory);

  if (arrivedTime === null) {
    return 0;
  }

  const stopTime = getWaitingTimeEndRange(statusHistory);

  return Math.round((stopTime - arrivedTime) / 60);
};

export const getTimeSpentInCurrentStatus = (encounter: Encounter): number => {
  const statusHistory = getVisitStatusHistory(encounter);
  const current = getLastUnterminatedStatusEntry(statusHistory);
  if (!current) {
    return 0;
  }
  return (
    -1.0 *
    (Math.round((DateTime.fromISO(current.period.start!).diffNow('minutes').minutes + Number.EPSILON) * 100) / 100)
  );
};
