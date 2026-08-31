import { Chip } from '@mui/material';
import { ReactElement } from 'react';

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
      primary: '#E0E0E0',
    },
    color: {
      primary: '#616161',
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
        fontWeight: 500,
        fontSize: '12px',
        // Tight line-height so the caps center in the chip: the default leaves
        // descender space at the bottom that uppercase never fills, which reads
        // as the text being shifted up.
        lineHeight: 1,
        textTransform: 'uppercase',
        background: colors.background.primary,
        color: colors.color.primary,
        padding: '0 2px',
        height: '18px',
        '& .MuiChip-label': { lineHeight: 1 },
      }}
      variant="outlined"
    />
  );
}
