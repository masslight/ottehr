import { Stack, Typography } from '@mui/material';
import React from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { AllergiesBody } from '../components/allergies/AllergiesBody';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
interface AllergiesProps {
  appointmentID?: string;
}

export const Allergies: React.FC<AllergiesProps> = () => {
  const {
    isAppointmentLoading,
    resources: { appointment },
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const { interactionMode } = useInPersonNavigationContext();
  const error = chartDataError || appointmentError;

  if (isAppointmentLoading || isChartDataLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        dataTestId={dataTestIds.allergies.allergiesPageTitle}
        label="Allergies"
        showIntakeNotesButton={interactionMode === 'main'}
      />
      <AllergiesBody />
    </Stack>
  );
};
