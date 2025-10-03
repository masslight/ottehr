import { styled, Typography, useTheme } from '@mui/material';
import React from 'react';
// import { ScanStatusChip } from '../statuses/ScanStatusChip';
// import { MedicationField } from '../medicationTypes';
import { ExtendedMedicationDataForResponse } from 'utils';
import { BarIcon } from './BarIcon';

interface MedicationNameProps {
  medication: ExtendedMedicationDataForResponse;
}

const StyledTypography = styled(Typography)<{ isScanned: boolean }>(({ theme, isScanned }) => ({
  display: 'flex',
  alignItems: 'start',
  width: 'fit-content',
  ...(isScanned
    ? {
        color: theme.palette.text.secondary,
        textDecoration: 'none',
      }
    : {
        cursor: 'pointer',
        color: theme.palette.primary.main,
        textDecoration: 'underline',
      }),
}));

export const MedicationBarcodeScan: React.FC<MedicationNameProps> = ({ medication }) => {
  const theme = useTheme();
  const isScanned = true; // medication.scanStatus === 'SCANNED';

  return (
    <>
      <StyledTypography isScanned={isScanned} sx={{ alignItems: 'center' }}>
        <BarIcon
          sx={{
            width: '24px',
            height: '24px',
            marginRight: theme.spacing(1.5),
            flexShrink: 0,
          }}
        />
        {medication.medicationName}
      </StyledTypography>
      {/* {medication.scanStatus && (
        <Box mt={1}>
          <ScanStatusChip medication={medication} />
        </Box>
      )} */}
    </>
  );
};
