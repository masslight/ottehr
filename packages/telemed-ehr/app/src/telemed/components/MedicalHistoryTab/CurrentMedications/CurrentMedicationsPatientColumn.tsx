import React, { FC } from 'react';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import { getQuestionnaireResponseByLinkId } from 'ehr-utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { PatientSideListSkeleton } from '../PatientSideListSkeleton';

export const CurrentMedicationsPatientColumn: FC = () => {
  const theme = useTheme();

  const { questionnaireResponse, isAppointmentLoading } = getSelectors(useAppointmentStore, [
    'questionnaireResponse',
    'isAppointmentLoading',
  ]);
  const currentMedications = getQuestionnaireResponseByLinkId('current-medications', questionnaireResponse)?.answer[0]
    .valueArray;

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
      ) : currentMedications ? (
        currentMedications.map((answer, index, arr) => (
          <Box key={index}>
            <Typography>{answer['current-medications-form-medication']}</Typography>
            {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
          </Box>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>Patient has no current medications</Typography>
      )}
    </Box>
  );
};
