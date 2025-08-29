import { Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { useAppointmentData, useChartData } from 'src/telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import {
  DispositionCard,
  PatientInstructionsCard,
  SchoolWorkExcuseCard,
} from '../../../telemed/features/appointment/PlanTab';
import { CSSLoader } from '../components/CSSLoader';
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

  if (isLoading || isChartDataLoading) return <CSSLoader />;
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
