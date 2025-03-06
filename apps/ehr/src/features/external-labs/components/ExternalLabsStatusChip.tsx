import { Chip } from '@mui/material';
import { ReactElement } from 'react';
import { ExternalLabsStatus } from '../helpers/types';

interface ExternalLabsStatusChipProps {
  status?: keyof typeof ExternalLabsStatus;
}

export const ExternalLabsStatusPalette: {
  [status in ExternalLabsStatus]: {
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
      primary: '#E6E8EE',
    },
    color: {
      primary: '#616161',
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
};

export function ExternalLabsStatusChip({ status }: ExternalLabsStatusChipProps): ReactElement {
  if (!status) {
    console.error('Status is undefined');
    return <span>Unknown status</span>;
  }

  if (!ExternalLabsStatusPalette[status]) {
    console.error(`Status "${status}" not found in ExternalLabsStatusPalette`);
    return <span>Invalid status: {status}</span>;
  }

  return (
    <Chip
      size="small"
      label={status}
      sx={{
        borderRadius: '4px',
        border: 'none',
        fontWeight: 700,
        fontSize: '12px',
        textTransform: 'uppercase',
        background: ExternalLabsStatusPalette[status].background.primary,
        color: ExternalLabsStatusPalette[status].color.primary,
      }}
      variant="outlined"
    />
  );
}
