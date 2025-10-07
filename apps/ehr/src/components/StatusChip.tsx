import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import React from 'react';

interface Props {
  status: string;
  style: 'grey' | 'green' | 'blue' | 'red' | 'orange' | 'purple' | 'whiteGrey';
}

interface Colors {
  bg: string;
  text: string;
  border?: string;
}

const STYLE_TO_COLORS: Record<string, Colors> = {
  grey: {
    bg: '#E6E8EE',
    text: '#616161',
  },
  green: {
    bg: '#C8E6C9',
    text: '#1B5E20',
  },
  blue: {
    bg: '#B2EBF2',
    text: '#006064',
  },
  red: {
    bg: '#FECDD2',
    text: '#B71C1C',
  },
  orange: {
    bg: '#FFE0B2',
    text: '#E65100',
  },
  purple: {
    bg: '#D1C4E9',
    text: '#4527A0',
  },
  whiteGrey: {
    bg: '#FFF',
    text: '#616161',
    border: '#BFC2C6',
  },
};

export const StatusChip: React.FC<Props> = ({ status, style }) => {
  const colors = STYLE_TO_COLORS[style];
  return (
    <Box
      style={{
        background: colors.bg,
        padding: '0px 8px 0px 8px',
        borderRadius: '4px',
        height: '20px',
        border: colors.border ? `1px solid ${colors.border}` : 'none',
      }}
      display="inline-flex"
      alignItems="center"
    >
      <Typography variant="body2" display="inline" style={{ color: colors.text }}>
        <span style={{ fontWeight: '500' }}>{status.toUpperCase()}</span>
      </Typography>
    </Box>
  );
};
