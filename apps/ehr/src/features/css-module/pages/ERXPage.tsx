import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useAppointmentData, useChartData } from 'src/telemed';
import { ERxContainer } from '../../../telemed/features/appointment/PlanTab';
import { CSSLoader } from '../components/CSSLoader';
interface ERXProps {
  appointmentID?: string;
}

export const ERXPage: React.FC<ERXProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const error = chartDataError || appointmentError;
  const isLoading = isAppointmentLoading || isChartDataLoading;

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1} sx={{ flex: '1 0 auto' }}>
      <ERxContainer />
    </Stack>
  );
};
