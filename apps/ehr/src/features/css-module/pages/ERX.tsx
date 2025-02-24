import React from 'react';
import { Typography, Stack } from '@mui/material';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { CSSLoader } from '../components/CSSLoader';
import { useAppointment } from '../hooks/useAppointment';
import { ERxContainer } from '../../../telemed/features/appointment/PlanTab';

interface ERXProps {
  appointmentID?: string;
}

export const ERX: React.FC<ERXProps> = () => {
  const { id: appointmentID } = useParams();

  const {
    sourceData: { appointment },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={2}>
      <ERxContainer />
      <div id="photon-prescribe-workflow-dialog" />
    </Stack>
  );
};
