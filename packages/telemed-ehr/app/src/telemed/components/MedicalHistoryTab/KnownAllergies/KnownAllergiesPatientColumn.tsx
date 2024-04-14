import React, { FC } from 'react';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import { getQuestionnaireResponseByLinkId } from 'ehr-utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { PatientSideListSkeleton } from '../PatientSideListSkeleton';

const mapAnswerToType = {
  Medications: 'medication',
  Food: 'food',
  Other: 'other',
};
export const KnownAllergiesPatientColumn: FC = () => {
  const theme = useTheme();

  const { questionnaireResponse, isAppointmentLoading } = getSelectors(useAppointmentStore, [
    'questionnaireResponse',
    'isAppointmentLoading',
  ]);
  const knownAllergies = getQuestionnaireResponseByLinkId('allergies', questionnaireResponse)?.answer[0].valueArray;

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
      ) : knownAllergies ? (
        knownAllergies.map((answer, index, arr) => (
          <Box key={index}>
            <Typography>
              {answer['allergies-form-agent-substance']} (
              {mapAnswerToType[answer['allergies-form-type'] as keyof typeof mapAnswerToType]})
            </Typography>
            {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
          </Box>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>Patient has no known allergies</Typography>
      )}
    </Box>
  );
};
