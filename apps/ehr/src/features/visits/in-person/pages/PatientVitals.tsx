import { Stack, Typography } from '@mui/material';
import React from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PageTitle } from 'src/features/visits/shared/components/PageTitle';
import { Loader } from '../../shared/components/Loader';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { PatientVitalsBody } from '../components/vitals/PatientVitalsBody';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';

interface PatientVitalsProps {
  appointmentID?: string;
}

export const PatientVitals: React.FC<PatientVitalsProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  const { interactionMode } = useInPersonNavigationContext();

  if (isLoading) return <Loader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        label="Vitals"
        showIntakeNotesButton={interactionMode === 'main'}
        dataTestId={dataTestIds.vitalsPage.title}
      />
      <PatientVitalsBody />
    </Stack>
  );
};
