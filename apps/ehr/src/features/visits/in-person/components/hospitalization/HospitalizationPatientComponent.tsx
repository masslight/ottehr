import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { PatientSideListSkeleton } from 'src/components/PatientSideListSkeleton';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { AiObservationField, ObservationTextFieldDTO } from 'utils';
import AiSuggestion from '../AiSuggestion';

export const HospitalizationPatientComponent: FC = () => {
  const theme = useTheme();
  const { isAppointmentLoading, mappedData: questionnaire } = useAppointmentData();
  const { chartData } = useChartData();
  const hospitalizations = questionnaire.hospitalizations;

  const aiHospitalizations = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.HospitalizationsHistory
  ) as ObservationTextFieldDTO[];

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
      {aiHospitalizations?.length > 0 && (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion title={'Hospitalization'} chartData={chartData} content={aiHospitalizations} />
        </>
      )}
    </Box>
  );
};
