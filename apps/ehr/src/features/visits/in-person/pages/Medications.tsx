import { Stack, Typography } from '@mui/material';
import React from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { MedicationsBody } from '../components/medications/MedicationsBody';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
interface MedicationsProps {
  appointmentID?: string;
}

export const Medications: React.FC<MedicationsProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  const { interactionMode } = useInPersonNavigationContext();

  if (isLoading || isChartDataLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        dataTestId={dataTestIds.medicationsPage.title}
        label="Medications"
        showIntakeNotesButton={interactionMode === 'main'}
      />
      <MedicationsBody />
    </Stack>
  );
};
