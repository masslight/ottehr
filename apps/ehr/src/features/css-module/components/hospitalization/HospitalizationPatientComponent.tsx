import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { AiObservationField, ObservationTextFieldDTO } from 'utils';
import AiSuggestion from '../../../../components/AiSuggestion';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../telemed';
import { PatientSideListSkeleton } from '../../../../telemed/features/appointment';
import { useAppointment } from '../../hooks/useAppointment';

export const HospitalizationPatientComponent: FC = () => {
  const theme = useTheme();

  const { isAppointmentLoading, chartData } = getSelectors(useAppointmentStore, ['isAppointmentLoading', 'chartData']);
  const { mappedData: questionnaire } = useAppointment();

  const hospitalizations = questionnaire.hospitalizations;

  const aiHospitalization = chartData?.observations?.find(
    (observation) => observation.field === AiObservationField.HospitalizationsHistory
  ) as ObservationTextFieldDTO;

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
      {aiHospitalization ? (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion title={'Hospitalization'} content={aiHospitalization.value} />
        </>
      ) : undefined}
    </Box>
  );
};
