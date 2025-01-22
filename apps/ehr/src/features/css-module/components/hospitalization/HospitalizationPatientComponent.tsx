import React, { FC } from 'react';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import { useAppointment } from '../../hooks/useAppointment';
import { PatientSideListSkeleton } from '../../../../telemed/features/appointment';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../telemed';

export const HospitalizationPatientComponent: FC = () => {
  const theme = useTheme();

  const { isAppointmentLoading } = getSelectors(useAppointmentStore, ['isAppointmentLoading']);
  const { processedData: questionnaire } = useAppointment();

  const hospitalizations = questionnaire.hospitalizations;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {isAppointmentLoading ? (
        <PatientSideListSkeleton />
      ) : hospitalizations ? (
        hospitalizations.map((answer, index, arr) => (
          <Box key={index}>
            <Typography>{answer}</Typography>
            {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
          </Box>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>Patient has no hospitalization</Typography>
      )}
    </Box>
  );
};
