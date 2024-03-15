import React, { FC } from 'react';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import { getQuestionnaireResponseByLinkId } from 'ehr-utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { PatientSideListSkeleton } from '../PatientSideListSkeleton';

export const MedicalConditionsPatientColumn: FC = () => {
  const theme = useTheme();

  const { questionnaireResponse, isAppointmentLoading } = getSelectors(useAppointmentStore, [
    'questionnaireResponse',
    'isAppointmentLoading',
  ]);
  const medicalConditions = getQuestionnaireResponseByLinkId('medical-history', questionnaireResponse)?.answer[0]
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
      ) : medicalConditions ? (
        medicalConditions.map((answer, index, arr) => (
          <Box key={index}>
            <Typography>{answer['medical-history-form-medical-condition']}</Typography>
            {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
          </Box>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>Patient has no medical conditions</Typography>
      )}
    </Box>
  );
};
