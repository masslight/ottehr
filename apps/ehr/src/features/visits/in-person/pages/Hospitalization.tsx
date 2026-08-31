import { Stack, Typography } from '@mui/material';
import React from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { HospitalizationBody } from '../components/hospitalization/HospitalizationBody';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
interface HospitalizationProps {
  appointmentID?: string;
}

export const Hospitalization: React.FC<HospitalizationProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const error = chartDataError || appointmentError;
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const { interactionMode } = useInPersonNavigationContext();

  if (isLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        dataTestId={dataTestIds.hospitalizationPage.hospitalizationTitle}
        label="Hospitalization"
        showIntakeNotesButton={interactionMode === 'main'}
      />
      <HospitalizationBody />
    </Stack>
  );
};
