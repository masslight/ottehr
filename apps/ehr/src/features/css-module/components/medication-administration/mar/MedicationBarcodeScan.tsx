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
      <StyledTypography isScanned={isScanned}>
        <BarIcon
          sx={{
            width: '34px',
            height: '34px',
            display: 'block',
            marginRight: theme.spacing(0.5),
            marginLeft: theme.spacing(-2),
            marginTop: theme.spacing(-1.4),
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
