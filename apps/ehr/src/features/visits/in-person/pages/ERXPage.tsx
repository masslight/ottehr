import { Typography } from '@mui/material';
import React from 'react';
import { Loader } from '../../shared/components/Loader';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { ERXBody } from '../components/erx/ERXBody';

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

  if (isLoading || isChartDataLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return <ERXBody />;
};
