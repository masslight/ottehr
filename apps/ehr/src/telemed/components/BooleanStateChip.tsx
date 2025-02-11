import React, { ReactElement } from 'react';
import { Chip } from '@mui/material';

interface BooleanStateChip {
  state: boolean;
  label: string;
  dataTestId?: string;
}

const theme = {
  on: {
    background: {
      primary: '#C8E6C9',
    },
    color: {
      primary: '#1B5E20',
    },
  },
  off: {
    background: {
      primary: '#FECDD2',
    },
    color: {
      primary: '#B71C1C',
    },
  },
};

export function BooleanStateChip({ state, label, dataTestId }: BooleanStateChip): ReactElement {
  const colors = state ? theme.on : theme.off;
  return (
    <Chip
      data-testid={dataTestId}
      size="small"
      label={label}
      sx={{
        borderRadius: '4px',
        border: 'none',
        fontWeight: 700,
        fontSize: '12px',
        textTransform: 'uppercase',
        background: colors.background.primary,
        color: colors.color.primary,
        padding: '0 2px',
        height: '18px',
      }}
      variant="outlined"
    />
  );
}
