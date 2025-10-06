import { Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { DispositionCard } from '../../shared/components/DispositionCard';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { PatientInstructionsCard } from '../../shared/components/plan-tab/PatientInstructionsCard';
import { SchoolWorkExcuseCard } from '../../shared/components/SchoolWorkExcuseCard';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
interface PlanProps {
  appointmentID?: string;
}

export const Plan: FC<PlanProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  if (isLoading || isChartDataLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Plan" showIntakeNotesButton={false} />
      <PatientInstructionsCard />
      <DispositionCard />
      <SchoolWorkExcuseCard />
    </Stack>
  );
};
