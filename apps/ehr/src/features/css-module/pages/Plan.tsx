import React, { FC } from 'react';
import { Typography, Stack } from '@mui/material';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { useAppointment } from '../hooks/useAppointment';
import { CSSLoader } from '../components/CSSLoader';
import {
  DispositionCard,
  PatientInstructionsCard,
  SchoolWorkExcuseCard,
} from '../../../telemed/features/appointment/PlanTab';

interface PlanProps {
  appointmentID?: string;
}

export const Plan: FC<PlanProps> = () => {
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
      <PatientInstructionsCard />
      <DispositionCard />
      <SchoolWorkExcuseCard />
    </Stack>
  );
};
