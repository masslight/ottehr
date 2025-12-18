import { Appointment, Encounter, EncounterParticipant, EncounterStatusHistory } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  InPersonAppointmentInformation,
  SupervisorApprovalStatus,
  VisitStatusHistoryEntry,
  VisitStatusHistoryLabel,
  VisitStatusLabel,
} from 'utils';
import { FHIR_EXTENSION } from '../fhir/constants';

export const NON_LOS_STATUSES: VisitStatusHistoryLabel[] = [
  'pending',
  'no show',
  'cancelled',
  'completed',
  'discharged',
  'awaiting supervisor approval',
];

export const getDurationOfStatus = (statusEntry: VisitStatusHistoryEntry, dateTimeNow: DateTime): number => {
  if (statusEntry.period.start && statusEntry.period.end) {
    return Math.floor(
      DateTime.fromISO(statusEntry.period.end).diff(DateTime.fromISO(statusEntry.period.start), 'minutes').minutes
    );
  } else if (statusEntry.period.start) {
    return Math.floor(dateTimeNow.diff(DateTime.fromISO(statusEntry.period.start), 'minutes').minutes);
  }
  return 0;
};

export const getTelemedLength = (history?: EncounterStatusHistory[]): number => {
  const value = history?.find((item) => item.status === 'in-progress');
  if (!value || !value.period.start) {
    return 0;
  }

  const { start, end } = value.period;
  const duration = DateTime.fromISO(start).diff(end ? DateTime.fromISO(end) : DateTime.now(), ['minute']);

  return Math.abs(duration.minutes);
};

export const getVisitTotalTime = (
  appointment: InPersonAppointmentInformation | Appointment,
  visitStatusHistory: VisitStatusHistoryEntry[],
  dateTimeNow: DateTime
): number => {
  if (appointment.start) {
    return visitStatusHistory
      .filter((status) => !NON_LOS_STATUSES.includes(status.status))
      .reduce((accumulator, statusTemp) => {
        return accumulator + getDurationOfStatus(statusTemp, dateTimeNow);
      }, 0);
  }
  return 0;
};

export const formatMinutes = (minutes: number): string => {
  return minutes.toLocaleString('en', { maximumFractionDigits: 0 });
};

export const getInPersonVisitStatus = (
  appointment: Appointment,
  encounter: Encounter,
  supervisorApprovalEnabled = false
): VisitStatusLabel => {
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
    const awaitingSupervisorApproval = encounter.extension?.some(
      (extension) => extension.url === 'awaiting-supervisor-approval' && extension.valueBoolean === true
    );

    if (supervisorApprovalEnabled && awaitingSupervisorApproval) {
      return 'awaiting supervisor approval';
    }

    return 'completed';
  }

  return 'unknown';
};

export const getVisitStatusHistory = (encounter: Encounter): VisitStatusHistoryEntry[] => {
  const visitHistory: VisitStatusHistoryEntry[] = [];

  encounter?.statusHistory?.forEach((statusHist: EncounterStatusHistory) => {
    const ottehrStatusFromExtension = statusHist.extension?.find(
      (ext) => ext.url === FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url
    )?.valueCode;

    if (ottehrStatusFromExtension) {
      visitHistory.push({
        status: ottehrStatusFromExtension as VisitStatusHistoryLabel,
        period: {
          ...(statusHist.period.start && { start: statusHist.period.start }),
          ...(statusHist.period.end && { end: statusHist.period.end }),
        },
      });
    } else if (statusHist.status === 'in-progress' && encounter?.participant) {
      // fallback: that's old logic, but that's wrong, because we need to compare with history participants, not with current ones
      const inProgressHistories = getInProgressVisitHistories(statusHist, encounter.participant);
      visitHistory.push(...inProgressHistories);
    } else {
      // fallback to old logic
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

      if (curVisitHistory.status) {
        curVisitHistory.period = statusHist.period;
        visitHistory.push(curVisitHistory);
      }
    }
  });
  return visitHistory;
};

// for backward compatibility
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

export const getSupervisorApprovalStatus = (
  appointment?: Appointment,
  encounter?: Encounter
): SupervisorApprovalStatus => {
  if (!appointment || !encounter) {
    return 'loading';
  }

  const visitStatus = getInPersonVisitStatus(appointment, encounter, true);

  if (visitStatus === 'awaiting supervisor approval') {
    return 'waiting-for-approval';
  } else if (visitStatus === 'completed') {
    return 'approved';
  }

  return 'unknown';
};
