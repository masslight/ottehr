import { Stack, Typography } from '@mui/material';
import React from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';
import { ScreeningBody } from '../components/screening/ScreeningBody';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';

interface ScreeningProps {
  appointmentID?: string;
}

export const Screening: React.FC<ScreeningProps> = () => {
  const { appointment, isAppointmentLoading } = useAppointmentData();

  const { interactionMode } = useInPersonNavigationContext();

  if (isAppointmentLoading) return <Loader />;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        dataTestId={dataTestIds.screeningPage.title}
        label="Screening Questions"
        showIntakeNotesButton={interactionMode === 'main'}
      />
      <ScreeningBody />
    </Stack>
  );
};
