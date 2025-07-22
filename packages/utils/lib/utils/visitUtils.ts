import { Appointment, Encounter, EncounterParticipant, EncounterStatusHistory } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  InPersonAppointmentInformation,
  VisitStatusHistoryEntry,
  VisitStatusHistoryLabel,
  VisitStatusLabel,
} from 'utils';

export const getDurationOfStatus = (statusEntry: VisitStatusHistoryEntry, dateTimeNow: DateTime): number => {
  if (statusEntry.period.start && statusEntry.period.end) {
    return DateTime.fromISO(statusEntry.period.end).diff(DateTime.fromISO(statusEntry.period.start), 'minutes').minutes;
  } else if (statusEntry.period.start) {
    const stopCountingForStatus: VisitStatusHistoryLabel[] = ['cancelled', 'no show', 'completed'];
    if (!stopCountingForStatus.includes(statusEntry.status)) {
      return dateTimeNow.diff(DateTime.fromISO(statusEntry.period.start), 'minutes').minutes;
    }
  }
  return 0;
};

export const getVisitTotalTime = (
  appointment: InPersonAppointmentInformation | Appointment,
  visitStatusHistory: VisitStatusHistoryEntry[],
  dateTimeNow: DateTime
): number => {
  if (appointment.start) {
    return visitStatusHistory
      .filter((status) => status.status !== 'pending')
      .reduce((accumulator, statusTemp) => {
        return accumulator + getDurationOfStatus(statusTemp, dateTimeNow);
      }, 0);
  }
  return 0;
};

export const formatMinutes = (minutes: number): string => {
  return minutes.toLocaleString('en', { maximumFractionDigits: 0 });
};

export const getVisitStatus = (appointment: Appointment, encounter: Encounter): VisitStatusLabel => {
  const admitterParticipant = encounter.participant?.find(
    (p) => p?.type?.find((t) => t?.coding?.find((coding) => coding.code === 'ADM'))
  );
  const attenderParticipant = encounter.participant?.find(
    (p) => p?.type?.find((t) => t?.coding?.find((coding) => coding.code === 'ATND'))
  );

  if (appointment.status === 'booked') {
    return 'pending';
  } else if (appointment.status === 'arrived') {
    return 'arrived';
  } else if (appointment.status === 'checked-in' && encounter.status === 'in-progress') {
    return 'intake';
  } else if (appointment.status === 'checked-in') {
    return 'ready';
  } else if (encounter.status === 'in-progress') {
    if (attenderParticipant?.period?.end) {
      return 'discharged';
    } else if (attenderParticipant?.period?.start) {
      return 'provider';
    } else if (admitterParticipant?.period?.end) {
      return 'ready for provider';
    } else {
      return 'intake';
    }
  } else if (appointment.status === 'cancelled' || encounter.status === 'cancelled') {
    return 'cancelled';
  } else if (appointment.status === 'noshow') {
    return 'no show';
  } else if (encounter.status === 'finished') {
    return 'completed';
  }

  return 'unknown';
};

export const getVisitStatusHistory = (encounter: Encounter): VisitStatusHistoryEntry[] => {
  const visitHistory: VisitStatusHistoryEntry[] = [];

  encounter?.statusHistory?.forEach((statusHist: EncounterStatusHistory) => {
    if (statusHist.status === 'in-progress') {
      if (encounter?.participant) {
        const inProgressHistories = getInProgressVisitHistories(statusHist, encounter.participant);
        visitHistory.push(...inProgressHistories);
      }
    } else {
      const curVisitHistory: any = {};
      if (statusHist.status === 'planned') {
        curVisitHistory.status = 'pending';
      } else if (statusHist.status === 'arrived') {
        curVisitHistory.status = 'arrived';
      } else if (statusHist.status === 'cancelled') {
        curVisitHistory.status = 'cancelled';
      } else if (statusHist.status === 'finished') {
        curVisitHistory.status = 'completed';
      }
      curVisitHistory.period = statusHist.period;
      visitHistory.push(curVisitHistory);
    }
  });
  return visitHistory;
};

const getInProgressVisitHistories = (
  statusHistory: EncounterStatusHistory,
  participantArray: EncounterParticipant[]
): VisitStatusHistoryEntry[] => {
  if (!participantArray.length) return [];
  const histories = participantArray.reduce((acc: VisitStatusHistoryEntry[], participantDetails) => {
    const isAdmitter = !!participantDetails.type?.find((t) => t?.coding?.find((coding) => coding.code === 'ADM'));
    const isAttender = !!participantDetails.type?.find((t) => t?.coding?.find((coding) => coding.code === 'ATND'));

    if (isAdmitter && participantDetails?.period && participantDetails?.period?.start) {
      acc.push({
        status: 'intake',
        period: participantDetails.period,
      });
      // add a status history for 'ready for provider' with a start time == intake end time
      if (participantDetails.period?.end) {
        const readyForProvider: VisitStatusHistoryEntry = {
          status: 'ready for provider',
          period: { start: participantDetails.period.end },
        };
        acc.push(readyForProvider);
      }
    } else if (isAttender && participantDetails?.period && participantDetails?.period?.start) {
      acc.push({
        status: 'provider',
        period: participantDetails.period,
      });
      // add a status history for 'discharged' with a start time == provider end time
      if (participantDetails.period?.end) {
        const readyForDischarge: VisitStatusHistoryEntry = {
          status: 'discharged',
          period: { start: participantDetails.period.end },
        };
        acc.push(readyForDischarge);
      }
    }

    return acc;
  }, []);

  histories.sort((a, b) => {
    const dateA = DateTime.fromISO(a.period.start || '').toMillis();
    const dateB = DateTime.fromISO(b.period.start || '').toMillis();
    return dateA - dateB;
  });

  // update the ready for provider status if provider status exists
  // and its start is later than ready for provider start
  const providerStatus = histories.find((h) => h.status === 'provider');
  if (providerStatus) {
    const readyForProviderStatus = histories.find((h) => h.status === 'ready for provider');
    if (
      readyForProviderStatus &&
      DateTime.fromISO(readyForProviderStatus.period.start || '') < DateTime.fromISO(providerStatus.period.start || '')
    ) {
      readyForProviderStatus.period.end = providerStatus.period.start;
    }
  }

  if (statusHistory.period.end && histories.length > 0) {
    const lastHistory = histories[histories.length - 1];
    if (!lastHistory.period.end) lastHistory.period.end = statusHistory.period.end;
  }

  return histories;
};
