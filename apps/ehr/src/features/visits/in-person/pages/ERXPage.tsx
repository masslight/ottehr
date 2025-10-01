import { Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { AiObservationField, ObservationTextFieldDTO } from 'utils';
import { Loader } from '../../shared/components/Loader';
import { ERxContainer } from '../../shared/components/plan-tab/ERxContainer';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';

interface ERXProps {
  appointmentID?: string;
}

export const ERXPage: React.FC<ERXProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { chartData, isChartDataLoading, chartDataError } = useChartData();
  const error = chartDataError || appointmentError;
  const isLoading = isAppointmentLoading || isChartDataLoading;

  const aiERX = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.eRX
  ) as ObservationTextFieldDTO[];

  if (isLoading || isChartDataLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1} sx={{ flex: '1 0 auto' }}>
      <ERxContainer />
      {aiERX?.length > 0 && (
        <Paper sx={{ padding: 2, marginBottom: 2 }}>
          <AiSuggestion title={'eRX'} chartData={chartData} content={aiERX} />
        </Paper>
      )}
    </Stack>
  );
};
