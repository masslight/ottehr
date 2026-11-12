import { Typography } from '@mui/material';
import React from 'react';
import { Loader } from '../../shared/components/Loader';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';
import { ERXSurescriptsBody } from '../components/erx/ERXSurescriptsBody';

export const ERXSurescriptsPage: React.FC = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  if (isAppointmentLoading) return <Loader />;
  if (appointmentError?.message) return <Typography>Error: {appointmentError.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return <ERXSurescriptsBody />;
};
