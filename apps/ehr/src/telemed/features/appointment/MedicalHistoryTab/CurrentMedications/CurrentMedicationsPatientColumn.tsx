import { Box, Divider, Typography, useTheme } from '@mui/material';
import React, { FC } from 'react';
import { AiObservationField, getQuestionnaireResponseByLinkId, ObservationTextFieldDTO } from 'utils';
import AiSuggestion from '../../../../../components/AiSuggestion';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { PatientSideListSkeleton } from '../PatientSideListSkeleton';

export const CurrentMedicationsPatientColumn: FC = () => {
  const theme = useTheme();

  const { questionnaireResponse, isAppointmentLoading, chartData } = getSelectors(useAppointmentStore, [
    'questionnaireResponse',
    'isAppointmentLoading',
    'chartData',
  ]);
  const currentMedications = getQuestionnaireResponseByLinkId('current-medications', questionnaireResponse)?.answer?.[0]
    .valueArray;

  const aiMedicationsHistory = chartData?.observations?.find(
    (observation) => observation.field === AiObservationField.MedicationsHistory
  ) as ObservationTextFieldDTO;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
      data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsPatientProvidedList}
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
      {aiMedicationsHistory ? (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion title={'Medications'} content={aiMedicationsHistory.value} />
        </>
      ) : undefined}
    </Box>
  );
};
