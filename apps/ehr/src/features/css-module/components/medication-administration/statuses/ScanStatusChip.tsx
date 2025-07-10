import { Chip } from '@mui/material';
import React from 'react';
import styled from 'styled-components';

interface ScanStatusChipProps {
  status?: 'SCANNED' | 'FAILED';
}

interface ColorScheme {
  bg: string;
  text: string;
}

const StyledChip = styled(Chip)(() => ({
  borderRadius: '8px',
  padding: '0 9px',
  margin: 0,
  height: '24px',
  '& .MuiChip-label': {
    padding: 0,
    fontWeight: 'bold',
    fontSize: '0.7rem',
  },
}));

const scanStatusColors: Record<string, ColorScheme> = {
  SCANNED: { bg: '#C8E6C9', text: '#1B5E20' },
  FAILED: { bg: '#FECDD2', text: '#B71C1C' },
};

export const ScanStatusChip: React.FC<ScanStatusChipProps> = ({ status }) => {
  if (!status) return null;

  const chipColors = scanStatusColors[status] || { bg: '#F5F5F5', text: '#757575' };

  return (
    <StyledChip
      label={status}
      sx={{
        backgroundColor: chipColors.bg,
        color: chipColors.text,
      }}
    />
  );
};
