import { Chip } from '@mui/material';
import { ReactElement } from 'react';
import { ExternalLabsStatus, LabOrderUnreceivedHistoryRow } from 'utils';

interface LabsOrderStatusChipProps {
  status: keyof typeof ExternalLabsStatus | LabOrderUnreceivedHistoryRow['action'];
}

export const ExternalLabsStatusPalette: {
  [status in ExternalLabsStatus | LabOrderUnreceivedHistoryRow['action']]: {
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
  created: {
    background: {
      primary: '#E6E8EE',
    },
    color: {
      primary: '#616161',
    },
  },
  pending: {
    background: {
      primary: '#E6E8EE',
    },
    color: {
      primary: '#616161',
    },
  },
  ready: {
    background: {
      primary: '#FFE0B2',
    },
    color: {
      primary: '#EF6C00',
    },
  },
  sent: {
    background: {
      primary: '#D1C4E9',
    },
    color: {
      primary: '#4527A0',
    },
  },
  'sent manually': {
    background: {
      primary: '#D1C4E9',
    },
    color: {
      primary: '#4527A0',
    },
  },
  received: {
    background: {
      primary: '#BBDEFB',
    },
    color: {
      primary: '#01579B',
    },
  },
  reviewed: {
    background: {
      primary: '#C8E6C9',
    },
    color: {
      primary: '#1B5E20',
    },
  },
  corrected: {
    background: {
      primary: '#BBDEFB',
    },
    color: {
      primary: '#01579B',
    },
  },
  cancelled: {
    background: {
      primary: '#FFCDD2',
    },
    color: {
      primary: '#D32F2F',
    },
  },
  prelim: {
    background: {
      primary: '#B3E5FC',
    },
    color: {
      primary: '#01579B',
    },
  },
  ordered: {
    background: {
      primary: '#E6E8EE',
    },
    color: {
      primary: '#616161',
    },
  },
  performed: {
    background: {
      primary: '#D1C4E9',
    },
    color: {
      primary: '#4527A0',
    },
  },
  'cancelled by lab': {
    background: {
      primary: '#FFCDD2',
    },
    color: {
      primary: '#D32F2F',
    },
  },
  unknown: {
    background: {
      primary: '#e3c254',
    },
    color: {
      primary: '#50221a',
    },
  },
};

export function LabsOrderStatusChip({ status }: LabsOrderStatusChipProps): ReactElement {
  return (
    <Chip
      size="small"
      label={status}
      sx={{
        borderRadius: '4px',
        border: 'none',
        fontWeight: 500,
        fontSize: '12px',
        textTransform: 'uppercase',
        background: ExternalLabsStatusPalette[status].background.primary,
        color: ExternalLabsStatusPalette[status].color.primary,
      }}
      variant="outlined"
    />
  );
}
