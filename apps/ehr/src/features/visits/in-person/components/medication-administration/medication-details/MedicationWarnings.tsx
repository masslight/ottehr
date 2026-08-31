import WarningIcon from '@mui/icons-material/Warning';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import React from 'react';
import { useMedicationManagement } from '../../../hooks/useMedicationManagement';

const WarningBox = styled(Box)(({ theme }) => ({
  backgroundColor: '#FFEBEE',
  color: '#D32F2F',
  padding: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  marginBottom: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
}));

export const MedicationWarnings: React.FC = () => {
  const { warnings } = useMedicationManagement();

  if (warnings.length === 0) {
    return null;
  }

  return (
    <>
      {warnings.map((warning, index) => (
        <WarningBox key={index}>
          <WarningIcon sx={{ marginRight: 1 }} />
          {typeof warning === 'string' ? <Typography variant="body2">{warning}</Typography> : warning}
        </WarningBox>
      ))}
    </>
  );
};
