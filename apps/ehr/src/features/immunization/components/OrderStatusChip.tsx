import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import React from 'react';

interface Props {
  status: 'pending' | 'administered' | 'partly-administered' | 'not-administered' | 'cancelled';
}

interface Colors {
  bg: string;
  text: string;
}

const STATUS_TO_BG_COLOR: Record<string, Colors> = {
  pending: {
    bg: '#E6E8EE',
    text: '#616161',
  },
  administered: {
    bg: '#C8E6C9',
    text: '#1B5E20',
  },
  'partly-administered': {
    bg: '#B2EBF2',
    text: '#006064',
  },
  'not-administered': {
    bg: '#FECDD2',
    text: '#B71C1C',
  },
  cancelled: {
    bg: '#FFF',
    text: '#616161',
  },
};

export const OrderStatusChip: React.FC<Props> = ({ status }) => {
  const colors = STATUS_TO_BG_COLOR[status];
  return (
    <Box
      style={{
        background: colors.bg,
        padding: '0px 8px 0px 8px',
        borderRadius: '4px',
        height: '20px',
        borderColor: status === 'cancelled' ? '#BFC2C6' : 'none',
      }}
      display="flex"
      alignItems="center"
    >
      <Typography variant="body2" display="inline" style={{ textTransform: 'uppercase', color: colors.text }}>
        <span style={{ fontWeight: '500' }}>{status}</span>
      </Typography>
    </Box>
  );
};
