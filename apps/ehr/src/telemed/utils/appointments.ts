import { Appointment, DocumentReference, Encounter, EncounterStatusHistory, FhirResource } from 'fhir/r4b';
import { DateTime, Duration } from 'luxon';
import {
  ApptTelemedTab,
  GetTelemedAppointmentsInput,
  mapStatusToTelemed,
  PATIENT_PHOTO_CODE,
  PROJECT_NAME,
  RefreshableAppointmentData,
  ReviewAndSignData,
  TelemedAppointmentInformation,
  TelemedAppointmentStatus,
  TelemedAppointmentStatusEnum,
  TelemedStatusHistoryElement,
} from 'utils';
import { AppointmentResources } from '../state';
import { diffInMinutes } from './diffInMinutes';

export const ApptTabToStatus: Record<ApptTelemedTab, TelemedAppointmentStatus[]> = {
  [ApptTelemedTab.ready]: [TelemedAppointmentStatusEnum.ready],
  [ApptTelemedTab.provider]: [TelemedAppointmentStatusEnum['pre-video'], TelemedAppointmentStatusEnum['on-video']],
  [ApptTelemedTab['not-signed']]: [TelemedAppointmentStatusEnum.unsigned],
  [ApptTelemedTab.complete]: [TelemedAppointmentStatusEnum.complete, TelemedAppointmentStatusEnum.cancelled],
};

export enum UnsignedFor {
  'under12' = 'under12',
  'more24' = 'more24',
  'all' = 'all',
}

export const compareLuxonDates = (a: DateTime, b: DateTime): number => a.toMillis() - b.toMillis();

export const getAppointmentUnsignedLengthTime = (history: TelemedStatusHistoryElement[]): number => {
  const lastHistoryRecord = history.at(-1);
  const currentTimeISO = new Date().toISOString();

  return compareLuxonDates(
    DateTime.fromISO(lastHistoryRecord?.end || currentTimeISO),
    DateTime.fromISO(lastHistoryRecord?.start || currentTimeISO)
  );
};

export const compareAppointments = (
  isNotSignedTab: boolean,
  appointmentA: TelemedAppointmentInformation,
  appointmentB: TelemedAppointmentInformation
): number => {
  if (isNotSignedTab) {
    return (
      getAppointmentUnsignedLengthTime(appointmentB.telemedStatusHistory) -
      getAppointmentUnsignedLengthTime(appointmentA.telemedStatusHistory)
    );
  } else {
    return compareLuxonDates(DateTime.fromISO(appointmentA.start!), DateTime.fromISO(appointmentB.start!));
  }
};

export const filterAppointments = (
  appointments: TelemedAppointmentInformation[],
  unsignedFor: UnsignedFor,
  tab: ApptTelemedTab,
  showOnlyNext: boolean,
  availableStates: string[]
): TelemedAppointmentInformation[] => {
  if (![ApptTelemedTab['not-signed'], ApptTelemedTab.ready].includes(tab)) {
    return appointments;
  }

  if (tab === ApptTelemedTab.ready) {
    if (showOnlyNext) {
      const oldest = appointments
        .filter((appointment) => availableStates.includes(appointment.locationVirtual.state!))
        .sort((a, b) => compareLuxonDates(DateTime.fromISO(a.start!), DateTime.fromISO(b.start!)))?.[0];

      return oldest ? [oldest] : [];
    } else {
      return appointments;
    }
  }

  const getUnsignedTime = (history: TelemedStatusHistoryElement[]): string => {
    const unsigned = history.find((element) => element.status === TelemedAppointmentStatusEnum.unsigned);
    if (!unsigned || !unsigned.start) {
      return DateTime.now().toISO()!;
    }
    return unsigned.start;
  };

  const now = DateTime.now();

  switch (unsignedFor) {
    case UnsignedFor.under12:
      return appointments.filter(
        (appointment) => DateTime.fromISO(getUnsignedTime(appointment.telemedStatusHistory)) > now.minus({ hours: 12 })
      );

    case UnsignedFor.more24:
      return appointments.filter(
        (appointment) => DateTime.fromISO(getUnsignedTime(appointment.telemedStatusHistory)) <= now.minus({ hours: 24 })
      );
    default:
      return appointments;
  }
};

export const getAppointmentWaitingTime = (statuses?: TelemedStatusHistoryElement[]): number | string => {
  if (!statuses) {
    return '...';
  }

  const onVideoIndex = statuses?.findIndex((status) => status.status === TelemedAppointmentStatusEnum['on-video']);

  const statusesToWait = onVideoIndex === -1 ? statuses : statuses.slice(0, onVideoIndex);

  const start = statusesToWait.at(0)!.start!;
  const end = statusesToWait.at(-1)?.end;

  return end
    ? diffInMinutes(DateTime.fromISO(end), DateTime.fromISO(start))
    : diffInMinutes(DateTime.now(), DateTime.fromISO(start));
};

export const formatVideoTimerTime = (difference: Duration): string => {
  const m = Math.abs(difference.minutes);
  const s = Math.floor(Math.abs(difference.seconds));

  const addZero = (num: number): string => {
    return num < 10 ? `0${num}` : num.toString();
  };

  return `${m}:${addZero(s)}`;
};

export const updateEncounterStatusHistory = (
  newStatus:
    | 'planned'
    | 'arrived'
    | 'triaged'
    | 'in-progress'
    // cSpell:disable-next onleave
    | 'onleave'
    | 'finished'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown',
  history?: EncounterStatusHistory[]
): EncounterStatusHistory[] => {
  const now = DateTime.now().toString();
  const newItem = { status: newStatus, period: { start: now } };

  if (!history || history.length === 0) {
    return [newItem];
  }

  history.at(-1)!.period.end = now;
  history.push(newItem);

  return history;
};

export const createRefreshableAppointmentData = (originalData: AppointmentResources[]): RefreshableAppointmentData => {
  const photoUrls = extractPhotoUrlsFromAppointmentData(originalData);
  return { patientConditionPhotoUrls: photoUrls };
};

export const extractPhotoUrlsFromAppointmentData = (appointment: AppointmentResources[]): string[] => {
  return (
    (appointment
      ?.filter(
        (resource: FhirResource) =>
          resource.resourceType === 'DocumentReference' &&
          resource.status === 'current' &&
          resource.type?.coding?.[0].code === PATIENT_PHOTO_CODE
      )
      .flatMap((docRef: FhirResource) => (docRef as DocumentReference).content.map((cnt) => cnt.attachment.url))
      .filter(Boolean) as string[]) || []
  );
};

export const extractReviewAndSignAppointmentData = (data: AppointmentResources[]): ReviewAndSignData | undefined => {
  const appointment = data?.find(
    (resource: FhirResource) => resource.resourceType === 'Appointment'
  ) as unknown as Appointment;

  if (!appointment) {
    return;
  }

  const appointmentStatus = appointment.status;

  const encounter = data?.find(
    (resource: FhirResource) => resource.resourceType === 'Encounter'
  ) as unknown as Encounter;

  if (!encounter) {
    return;
  }

  const encounterStatusHistory = encounter.statusHistory ?? [];
  const finishedHistoryEntry = encounterStatusHistory.find((historyElement) => historyElement.status === 'finished');
  const finishedAtTime = finishedHistoryEntry?.period?.end;
  const encounterStatus = finishedHistoryEntry?.status;
  if (!encounterStatus) {
    return;
  }

  const telemedAppointmentStatus = mapStatusToTelemed(encounterStatus, appointmentStatus);

  return telemedAppointmentStatus === TelemedAppointmentStatusEnum.complete
    ? { signedOnDate: finishedAtTime }
    : undefined;
};

export const TelemedAppointmentStatusToPalette: {
  [status in TelemedAppointmentStatusEnum]: {
    background: {
      primary: string;
      secondary?: string;
    };
    color: {
      primary: string;
      secondary?: string;
    };
  };
} = {
  ready: {
    background: {
      primary: '#FFE0B2',
    },
    color: {
      primary: '#E65100',
    },
  },
  'pre-video': {
    background: {
      primary: '#B3E5FC',
    },
    color: {
      primary: '#01579B',
    },
  },
  'on-video': {
    background: {
      primary: '#D1C4E9',
    },
    color: {
      primary: '#311B92',
    },
  },
  unsigned: {
    background: {
      primary: '#FFCCBC',
    },
    color: {
      primary: '#BF360C',
    },
  },
  complete: {
    background: {
      primary: '#C8E6C9',
    },
    color: {
      primary: '#1B5E20',
    },
  },
  cancelled: {
    background: {
      primary: '#FFCCBC',
    },
    color: {
      primary: '#BF360C',
    },
  },
};

export type GetAppointmentsRequestParams = Pick<
  GetTelemedAppointmentsInput,
  | 'usStatesFilter'
  | 'providersFilter'
  | 'dateFilter'
  | 'groupsFilter'
  | 'patientFilter'
  | 'statusesFilter'
  | 'locationsIdsFilter'
  | 'visitTypesFilter'
>;

export const APPT_STATUS_MAP: {
  [status in TelemedAppointmentStatus]: {
    background: {
      primary: string;
      secondary?: string;
    };
    color: {
      primary: string;
      secondary?: string;
    };
  };
} = {
  ready: {
    background: {
      primary: '#FFE0B2',
    },
    color: {
      primary: '#E65100',
    },
  },
  'pre-video': {
    background: {
      primary: '#B3E5FC',
    },
    color: {
      primary: '#01579B',
    },
  },
  'on-video': {
    background: {
      primary: '#D1C4E9',
    },
    color: {
      primary: '#311B92',
    },
  },
  unsigned: {
    background: {
      primary: '#FFCCBC',
    },
    color: {
      primary: '#BF360C',
    },
  },
  complete: {
    background: {
      primary: '#C8E6C9',
    },
    color: {
      primary: '#1B5E20',
    },
  },
  cancelled: {
    background: {
      primary: '#FFCCBC',
    },
    color: {
      primary: '#BF360C',
    },
  },
};

export const quickTexts: string[] = [
  `Hello from ${PROJECT_NAME} Telemedicine. A provider will see you soon. Please have your child with you, seated & in a quiet room. Please be in an area where you have strong wifi connection sufficient for video use. Have your video turned on. Questions? Call <phone>202-555-1212</phone>`,
  `Hello from ${PROJECT_NAME} Telemedicine. Due to high volumes our providers are busier than usual. A provider will message you when they have an update or are ready to see you. We apologize for the delay. Questions? Call <phone>202-555-1212</phone>`,
  `Hello from ${PROJECT_NAME} Telemedicine. We tried connecting, you seem to be having trouble connecting. If you still want a visit, log out then log back in. Click “Return to call” and we will connect with you in 5-10 minutes. If you are still having trouble, call <phone>202-555-1212</phone>`,
  `Hello from ${PROJECT_NAME} Telemedicine. We are sorry you canceled your visit. If accidental, please request a new visit. We will be sure to see you. If you are experiencing technical difficulties, call <phone>202-555-1212</phone>`,
];
