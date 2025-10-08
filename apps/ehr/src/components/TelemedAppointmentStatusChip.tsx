import { ReactElement } from 'react';
import { TelemedAppointmentStatus } from 'utils';
import { MappedStatusChip } from './MappedStatusChip';

export const TELEMED_APPT_STATUS_MAP: {
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

// added to handle different mappers (e.g. IP ones) with same style
export function TelemedAppointmentStatusChip({
  status,
  count,
}: {
  status: TelemedAppointmentStatus;
  count?: number;
}): ReactElement {
  return <MappedStatusChip status={status} count={count} mapper={TELEMED_APPT_STATUS_MAP} />;
}
