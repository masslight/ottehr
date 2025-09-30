import { Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { DispositionCard, PatientInstructionsCard, SchoolWorkExcuseCard } from 'src/components/PlanTab';
import { useAppointmentData, useChartData } from 'src/shared/hooks/appointment/appointment.store';
import { PageTitle } from '../../../components/PageTitle';
import { InPersonLoader } from '../components/InPersonLoader';
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

  if (isLoading || isChartDataLoading) return <InPersonLoader />;
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
