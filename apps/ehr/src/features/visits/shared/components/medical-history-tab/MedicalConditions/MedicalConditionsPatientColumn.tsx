import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { PatientSideListSkeleton } from 'src/components/PatientSideListSkeleton';
import { dataTestIds } from 'src/constants/data-test-ids';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { AiObservationField, getQuestionnaireResponseByLinkId, ObservationTextFieldDTO } from 'utils';
import { useAppointmentData, useChartData } from '../../../stores/appointment/appointment.store';

export const MedicalConditionsPatientColumn: FC = () => {
  const theme = useTheme();
  const { questionnaireResponse, isAppointmentLoading } = useAppointmentData();
  const { chartData } = useChartData();

  const medicalConditions = getQuestionnaireResponseByLinkId('medical-history', questionnaireResponse)?.answer?.[0]
    ?.valueArray;

  const aiPastMedicalHistory = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.PastMedicalHistory
  ) as ObservationTextFieldDTO[];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
      data-testid={dataTestIds.medicalConditions.medicalConditionPatientProvidedList}
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
      {aiPastMedicalHistory?.length > 0 && (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion title={'Past Medical History (PMH)'} chartData={chartData} content={aiPastMedicalHistory} />
        </>
      )}
    </Box>
  );
};
