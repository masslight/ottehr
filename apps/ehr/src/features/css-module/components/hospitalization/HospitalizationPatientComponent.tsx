import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../telemed';
import { PatientSideListSkeleton } from '../../../../telemed/features/appointment';
import { useAppointment } from '../../hooks/useAppointment';

export const HospitalizationPatientComponent: FC = () => {
  const theme = useTheme();

  const { isAppointmentLoading } = getSelectors(useAppointmentStore, ['isAppointmentLoading']);
  const { mappedData: questionnaire } = useAppointment();

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
      ) : hospitalizations?.length ? (
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
