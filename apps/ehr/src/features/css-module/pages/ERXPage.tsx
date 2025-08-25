import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import AiSuggestion from 'src/components/AiSuggestion';
import { AiObservationField, ObservationTextFieldDTO } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { ERxContainer } from '../../../telemed/features/appointment/PlanTab';
import { CSSLoader } from '../components/CSSLoader';
import { useAppointment } from '../hooks/useAppointment';

interface ERXProps {
  appointmentID?: string;
}

export const ERXPage: React.FC<ERXProps> = () => {
  const { id: appointmentID } = useParams();

  const {
    resources: { appointment },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const { isChartDataLoading, chartData } = getSelectors(useAppointmentStore, ['isChartDataLoading', 'chartData']);

  const aiERX = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.eRX
  ) as ObservationTextFieldDTO[];

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1} sx={{ flex: '1 0 auto' }}>
      <ERxContainer />
      {aiERX?.length > 0 && (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion title={'eRX'} chartData={chartData} content={aiERX} />
        </>
      )}
    </Stack>
  );
};
