import { Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { ALL_LOCATIONS } from 'utils';
import { DispositionCard } from '../../shared/components/DispositionCard';
import { FormsCard } from '../../shared/components/FormsCard';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { PatientInstructionsCard } from '../../shared/components/plan-tab/PatientInstructionsCard';
import { SchoolWorkExcuseCard } from '../../shared/components/SchoolWorkExcuseCard';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
interface PlanProps {
  appointmentID?: string;
}

export const Plan: FC<PlanProps> = () => {
  const { appointment, location, isAppointmentLoading, appointmentError } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  if (isLoading || isChartDataLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;
  const locationName = location?.name as (typeof ALL_LOCATIONS)[number] | undefined;

  return (
    <Stack spacing={1}>
      <PageTitle label="Plan" showIntakeNotesButton={false} />
      <PatientInstructionsCard />
      <DispositionCard />
      <SchoolWorkExcuseCard locationName={locationName} />
      {FEATURE_FLAGS.FORMS_ENABLED && <FormsCard />}
    </Stack>
  );
};
