import { ReactElement } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { VisitStatusLabel } from 'utils';

export const IN_PERSON_CHIP_STATUS_MAP: {
  [status in VisitStatusLabel]: {
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
  pending: {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#546E7A',
    },
  },
  arrived: {
    background: {
      primary: '#ECEFF1',
      secondary: '#9E9E9E',
    },
    color: {
      primary: '#37474F',
    },
  },
  ready: {
    background: {
      primary: '#C8E6C9',
      secondary: '#43A047',
    },
    color: {
      primary: '#1B5E20',
    },
  },
  intake: {
    background: {
      primary: '#e0b6fc',
    },
    color: {
      primary: '#412654',
    },
  },
  'ready for provider': {
    background: {
      primary: '#D1C4E9',
      secondary: '#673AB7',
    },
    color: {
      primary: '#311B92',
    },
  },
  provider: {
    background: {
      primary: '#B3E5FC',
    },
    color: {
      primary: '#01579B',
    },
  },
  discharged: {
    background: {
      primary: '#B2EBF2',
    },
    color: {
      primary: '#006064',
    },
  },
  completed: {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#546E7A',
    },
  },
  'awaiting supervisor approval': {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#546E7A',
    },
  },
  cancelled: {
    background: {
      primary: '#FECDD2',
    },
    color: {
      primary: '#B71C1C',
    },
  },
  'no show': {
    background: {
      primary: '#DFE5E9',
    },
    color: {
      primary: '#212121',
    },
  },
  unknown: {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#000000',
    },
  },
};

export function InPersonAppointmentStatusChip({
  status,
  count,
}: {
  status: VisitStatusLabel | undefined;
  count?: number;
}): ReactElement {
  if (!status) {
    return <></>;
  }

  if (!IN_PERSON_CHIP_STATUS_MAP[status]) {
    return <></>;
  }

  return (
    <span
      data-testid={dataTestIds.dashboard.appointmentStatus}
      style={{
        fontSize: '12px',
        borderRadius: '4px',
        border: `${['pending', 'checked out'].includes(status) ? '1px solid #BFC2C6' : 'none'}`,
        textTransform: 'uppercase',
        background: IN_PERSON_CHIP_STATUS_MAP[status].background.primary,
        color: IN_PERSON_CHIP_STATUS_MAP[status].color.primary,
        display: 'inline-block',
        padding: '2px 8px 0 8px',
        verticalAlign: 'middle',
      }}
    >
      {count ? `${status} - ${count}` : status}
    </span>
  );
}
