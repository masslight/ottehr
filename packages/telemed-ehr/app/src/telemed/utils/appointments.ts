import {
  GetTelemedAppointmentsInput,
  TelemedAppointmentInformation,
  TelemedStatusHistoryElement,
  PATIENT_PHOTO_CODE,
  TelemedAppointmentStatus,
} from 'ehr-utils';
import { DateTime } from 'luxon';
import { diffInMinutes } from './diffInMinutes';
import { Bundle, FhirResource, DocumentReference, EncounterStatusHistory } from 'fhir/r4';

export enum ApptTab {
  'ready' = 'ready',
  'provider' = 'provider',
  'not-signed' = 'not-signed',
  'complete' = 'complete',
}

export const ApptTabToStatus: Record<ApptTab, TelemedAppointmentStatus[]> = {
  [ApptTab.ready]: [TelemedAppointmentStatus.ready],
  [ApptTab.provider]: [TelemedAppointmentStatus['pre-video'], TelemedAppointmentStatus['on-video']],
  [ApptTab['not-signed']]: [TelemedAppointmentStatus.unsigned],
  [ApptTab.complete]: [TelemedAppointmentStatus.complete],
};

export enum UnsignedFor {
  'under12' = 'under12',
  '12to24' = '12to24',
  'more24' = 'more24',
  'all' = 'all',
}

export const compareLuxonDates = (a: DateTime, b: DateTime): number => a.toMillis() - b.toMillis();

export const updateEncounterStatusHistory = (
  newStatus:
    | 'planned'
    | 'arrived'
    | 'triaged'
    | 'in-progress'
    | 'onleave'
    | 'finished'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown',
  history?: EncounterStatusHistory[],
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

export const extractPhotoUrlsFromAppointmentData = (appointment: Bundle<FhirResource>[]): string[] => {
  return (
    (appointment
      ?.filter(
        (resource: FhirResource) =>
          resource.resourceType === 'DocumentReference' &&
          resource.status === 'current' &&
          resource.type?.coding?.[0].code === PATIENT_PHOTO_CODE,
      )
      .flatMap((docRef: FhirResource) => (docRef as DocumentReference).content.map((cnt) => cnt.attachment.url))
      .filter(Boolean) as string[]) || []
  );
};

export const filterAppointments = (
  appointments: TelemedAppointmentInformation[],
  unsignedFor: UnsignedFor,
  tab: ApptTab,
  showOnlyNext: boolean,
  availableStates: string[],
): TelemedAppointmentInformation[] => {
  if (![ApptTab['not-signed'], ApptTab.ready].includes(tab)) {
    return appointments;
  }

  if (tab === ApptTab.ready) {
    if (showOnlyNext) {
      const oldest = appointments
        .filter((appointment) => availableStates.includes(appointment.location.state!))
        .sort((a, b) => compareLuxonDates(DateTime.fromISO(a.start!), DateTime.fromISO(b.start!)))?.[0];

      return oldest ? [oldest] : [];
    } else {
      return appointments;
    }
  }

  const getUnsignedTime = (history: TelemedStatusHistoryElement[]): string => {
    const unsigned = history.find((element) => element.status === TelemedAppointmentStatus.unsigned);
    if (!unsigned || !unsigned.start) {
      return DateTime.now().toISO()!;
    }
    return unsigned.start;
  };

  const now = DateTime.now();

  switch (unsignedFor) {
    case UnsignedFor.under12:
      return appointments.filter(
        (appointment) => DateTime.fromISO(getUnsignedTime(appointment.telemedStatusHistory)) > now.minus({ hours: 12 }),
      );

    case UnsignedFor.more24:
      return appointments.filter(
        (appointment) =>
          DateTime.fromISO(getUnsignedTime(appointment.telemedStatusHistory)) <= now.minus({ hours: 24 }),
      );
    default:
      return appointments;
  }
};

export const getAppointmentUnsignedLengthTime = (history: TelemedStatusHistoryElement[]): number => {
  const lastHistoryRecord = history.at(-1);
  const currentTimeISO = new Date().toISOString();

  return compareLuxonDates(
    DateTime.fromISO(lastHistoryRecord?.end || currentTimeISO),
    DateTime.fromISO(lastHistoryRecord?.start || currentTimeISO),
  );
};

export const compareAppointments = (
  isNotSignedTab: boolean,
  appointmentA: TelemedAppointmentInformation,
  appointmentB: TelemedAppointmentInformation,
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

export const getAppointmentWaitingTime = (statuses?: TelemedStatusHistoryElement[]): number | string => {
  if (!statuses) {
    return '...';
  }

  const onVideoIndex = statuses?.findIndex((status) => status.status === TelemedAppointmentStatus['on-video']);

  const statusesToWait = onVideoIndex === -1 ? statuses : statuses.slice(0, onVideoIndex);

  const start = statusesToWait.at(0)!.start!;
  const end = statusesToWait.at(-1)?.end;

  return end
    ? diffInMinutes(DateTime.fromISO(end), DateTime.fromISO(start))
    : diffInMinutes(DateTime.now(), DateTime.fromISO(start));
};

export const ApptStatusToPalette: {
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
      primary: '#E0E0E0',
    },
    color: {
      primary: '#757575',
    },
  },
};

export type GetAppointmentsRequestParams = Pick<
  GetTelemedAppointmentsInput,
  'usStatesFilter' | 'dateFilter' | 'patientFilter' | 'statusesFilter'
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
      primary: '#E0E0E0',
    },
    color: {
      primary: '#757575',
    },
  },
};

export const quickTexts: string[] = [
  'Hello from Ottehr Telemedicine. A provider will see you soon. Please have your child with you, seated & in a quiet room. Please be in an area where you have strong wifi connection sufficient for video use. Have your video turned on. Questions? Call <phone>516-207-7950</phone>',
  'Hello from Ottehr Telemedicine. Due to high volumes our providers are busier than usual. A provider will message you when they have an update or are ready to see you. We apologize for the delay. Questions? Call <phone>516-207-7950</phone>',
  'Hello from Ottehr Telemedicine. We tried connecting, you seem to be having trouble connecting. If you still want a visit, log out then log back in. Click “Return to call” and we will connect with you in 5-10 minutes. If you are still having trouble, call <phone>516-207-7950</phone>',
  'Hello from Ottehr Telemedicine. We are sorry you canceled your visit. If accidental, please request a new visit. We will be sure to see you. If you are experiencing technical difficulties, call <phone>516-207-7950</phone>',
];
