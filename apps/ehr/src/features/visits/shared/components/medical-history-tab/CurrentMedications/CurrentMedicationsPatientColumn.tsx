import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { PatientSideListSkeleton } from 'src/components/PatientSideListSkeleton';
import { dataTestIds } from 'src/constants/data-test-ids';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { AiObservationField, getQuestionnaireResponseByLinkId, ObservationTextFieldDTO } from 'utils';
import { useAppointmentData, useChartData } from '../../../stores/appointment/appointment.store';

export const CurrentMedicationsPatientColumn: FC = () => {
  const theme = useTheme();
  const { questionnaireResponse, isAppointmentLoading } = useAppointmentData();
  const { chartData } = useChartData();

  const currentMedications = getQuestionnaireResponseByLinkId('current-medications', questionnaireResponse)?.answer?.[0]
    .valueArray;

  const aiMedicationsHistory = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.MedicationsHistory
  ) as ObservationTextFieldDTO[];

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
      {aiMedicationsHistory?.length > 0 && (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion title={'Medications'} chartData={chartData} content={aiMedicationsHistory} />
        </>
      )}
    </Box>
  );
};
