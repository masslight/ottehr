import {
  GetTelemedAppointmentsInput,
  ApptStatus,
  TelemedAppointmentInformation,
  TelemedStatusHistoryElement,
} from 'ehr-utils';
import { DateTime } from 'luxon';
import { diffInMinutes } from './diffInMinutes';

export enum ApptTab {
  'ready' = 'ready',
  'provider' = 'provider',
  'not-signed' = 'not-signed',
  'complete' = 'complete',
}

export const ApptTabToStatus: Record<ApptTab, ApptStatus[]> = {
  [ApptTab.ready]: [ApptStatus.ready],
  [ApptTab.provider]: [ApptStatus['pre-video'], ApptStatus['on-video']],
  [ApptTab['not-signed']]: [ApptStatus.unsigned],
  [ApptTab.complete]: [ApptStatus.complete],
};

export enum UnsignedFor {
  'under12' = 'under12',
  '12to24' = '12to24',
  'more24' = 'more24',
  'all' = 'all',
}

export const filterAppointments = (
  appointments: TelemedAppointmentInformation[],
  unsignedFor: UnsignedFor,
  tab: ApptTab,
): TelemedAppointmentInformation[] => {
  if (tab !== ApptTab['not-signed']) {
    return appointments;
  }

  const getUnsignedTime = (history: TelemedStatusHistoryElement[]): string => {
    const unsigned = history.find((element) => element.status === ApptStatus.unsigned);
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
    case UnsignedFor['12to24']:
      return appointments.filter(
        (appointment) =>
          DateTime.fromISO(getUnsignedTime(appointment.telemedStatusHistory)) < now.minus({ hours: 12 }) &&
          DateTime.fromISO(getUnsignedTime(appointment.telemedStatusHistory)) >= now.minus({ hours: 24 }),
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

export const getAppointmentWaitingTime = (statuses?: TelemedStatusHistoryElement[]): number | string => {
  if (!statuses) {
    return '...';
  }

  const onVideoIndex = statuses?.findIndex((status) => status.status === ApptStatus['on-video']);

  const statusesToWait = onVideoIndex === -1 ? statuses : statuses.slice(0, onVideoIndex);

  const start = statusesToWait.at(0)!.start!;
  const end = statusesToWait.at(-1)?.end;

  return end
    ? diffInMinutes(DateTime.fromISO(end), DateTime.fromISO(start))
    : diffInMinutes(DateTime.now(), DateTime.fromISO(start));
};

export const ApptStatusToPalette: {
  [status in ApptStatus]: {
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
};

export type GetAppointmentsRequestParams = Pick<
  GetTelemedAppointmentsInput,
  'stateFilter' | 'providersFilter' | 'dateFilter' | 'groupsFilter' | 'patientFilter' | 'statusesFilter'
>;

export const APPT_STATUS_MAP: {
  [status in ApptStatus]: {
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
};
