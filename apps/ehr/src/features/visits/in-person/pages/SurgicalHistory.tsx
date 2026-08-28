import { Stack, Typography } from '@mui/material';
import React from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { SurgicalHistoryBody } from '../components/surgical-history/SurgicalHistoryBody';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
interface SurgicalHistoryProps {
  appointmentID?: string;
}

export const SurgicalHistory: React.FC<SurgicalHistoryProps> = () => {
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
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        label="Surgical History"
        showIntakeNotesButton={interactionMode === 'main'}
        dataTestId={dataTestIds.surgicalHistory.surgicalHistoryTitle}
      />
      <SurgicalHistoryBody />
    </Stack>
  );
};
