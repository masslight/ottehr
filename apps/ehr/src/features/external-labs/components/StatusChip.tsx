import React from 'react';
import { Chip, useTheme } from '@mui/material';

export type StatusString = 'pending' | 'assigned' | 'collected' | 'received' | 'reviewed';

export const StatusChip: React.FC<{ status: StatusString }> = ({ status }) => {
  const theme = useTheme();

  let colors;
  switch (status) {
    case 'assigned':
      colors = theme.palette.warning;
      break;
    case 'collected':
      colors = theme.palette.info;
      break;
    case 'received':
      colors = theme.palette.error;
      break;
    case 'reviewed':
      colors = theme.palette.success;
      break;
    default:
      colors = {
        light: '#C5CBD3',
        contrastText: '#5F6B7C',
      };
  }

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
        background: colors?.light,
        color: colors?.contrastText,
        padding: '0 2px',
        height: '18px',
      }}
      variant="outlined"
    />
  );
};
