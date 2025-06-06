import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
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

  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1} sx={{ flex: '1 0 auto' }}>
      <ERxContainer />
      <div id="prescribe-dialog" style={{ flex: '1 0 auto' }} />
    </Stack>
  );
};
