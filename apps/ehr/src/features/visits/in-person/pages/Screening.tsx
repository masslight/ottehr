import { Stack, Typography } from '@mui/material';
import React from 'react';
import { ADDITIONAL_QUESTIONS_META_SYSTEM } from 'utils';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { useChartFields } from '../../shared/hooks/useChartFields';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';
import AskThePatient from '../components/screening/AskThePatient';
import { ASQ } from '../components/screening/ASQ';
import { Questions } from '../components/screening/PaperworkAndConfirmedQuestions';
import { ScreeningNotes } from '../components/screening/ScreeningNotes';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';

interface ScreeningProps {
  appointmentID?: string;
}

export const Screening: React.FC<ScreeningProps> = () => {
  const { appointment, isAppointmentLoading } = useAppointmentData();

  const { isLoading: isChartDataLoading } = useChartFields({
    requestedFields: {
      observations: {
        _tag: ADDITIONAL_QUESTIONS_META_SYSTEM,
        _search_by: 'encounter',
      },
    },
  });

  const { interactionMode } = useInPersonNavigationContext();

  if (isChartDataLoading || isAppointmentLoading) return <Loader />;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Screening" showIntakeNotesButton={interactionMode === 'intake'} />
      <Questions />
      <AskThePatient />
      <ASQ />
      <ScreeningNotes />
    </Stack>
  );
};
