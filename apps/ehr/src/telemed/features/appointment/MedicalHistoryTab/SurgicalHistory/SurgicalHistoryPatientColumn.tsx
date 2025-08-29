import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { AiObservationField, getQuestionnaireResponseByLinkId, ObservationTextFieldDTO } from 'utils';
import AiSuggestion from '../../../../../components/AiSuggestion';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useAppointmentData, useChartData } from '../../../../state';
import { PatientSideListSkeleton } from '../PatientSideListSkeleton';

export const SurgicalHistoryPatientColumn: FC = () => {
  const theme = useTheme();
  const { questionnaireResponse, isAppointmentLoading } = useAppointmentData();
  const { chartData } = useChartData();

  const surgicalHistory = getQuestionnaireResponseByLinkId('surgical-history', questionnaireResponse)?.answer?.[0]
    ?.valueArray;

  const aiPastSurgicalHistory = chartData?.observations?.find(
    (observation) => observation.field === AiObservationField.PastSurgicalHistory
  ) as ObservationTextFieldDTO;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
      data-testid={dataTestIds.telemedEhrFlow.hpiSurgicalHistoryPatientProvidedList}
    >
      {isAppointmentLoading ? (
        <PatientSideListSkeleton />
      ) : surgicalHistory ? (
        surgicalHistory.map((answer, index, arr) => (
          <Box key={index}>
            <Typography>{answer['surgical-history-form-type']}</Typography>
            {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
          </Box>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>Patient has no surgical history</Typography>
      )}
      {aiPastSurgicalHistory ? (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion title={'Past Surgical History (PSH)'} content={aiPastSurgicalHistory.value} />
        </>
      ) : undefined}
    </Box>
  );
};
