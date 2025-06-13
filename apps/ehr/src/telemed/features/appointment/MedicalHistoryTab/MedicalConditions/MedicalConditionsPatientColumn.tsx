import React, { FC } from 'react';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import { AiObservationField, getQuestionnaireResponseByLinkId, ObservationTextFieldDTO } from 'utils';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { PatientSideListSkeleton } from '../PatientSideListSkeleton';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import AiSuggestion from '../../../../../components/AiSuggestion';

export const MedicalConditionsPatientColumn: FC = () => {
  const theme = useTheme();

  const { questionnaireResponse, isAppointmentLoading, chartData } = getSelectors(useAppointmentStore, [
    'questionnaireResponse',
    'isAppointmentLoading',
    'chartData',
  ]);
  const medicalConditions = getQuestionnaireResponseByLinkId('medical-history', questionnaireResponse)?.answer?.[0]
    ?.valueArray;

  const aiPastMedicalHistory = chartData?.observations?.find(
    (observation) => observation.field === AiObservationField.PastMedicalHistory
  ) as ObservationTextFieldDTO;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
      data-testid={dataTestIds.telemedEhrFlow.hpiMedicalConditionPatientProvidedList}
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
      {aiPastMedicalHistory ? (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion title={'Past Medical History (PMH)'} content={aiPastMedicalHistory.value} />
        </>
      ) : undefined}
    </Box>
  );
};
