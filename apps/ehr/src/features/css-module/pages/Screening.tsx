import { Stack, Typography } from '@mui/material';
import React from 'react';
import { ADDITIONAL_QUESTIONS_META_SYSTEM } from 'utils';
import { useAppointmentData, useChartData } from '../../../telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { CSSLoader } from '../components/CSSLoader';
import AskThePatient from '../components/screening/AskThePatient';
import { ASQ } from '../components/screening/ASQ';
import { Questions } from '../components/screening/PaperworkAndConfirmedQuestions';
import { ScreeningNotes } from '../components/screening/ScreeningNotes';
import { useNavigationContext } from '../context/NavigationContext';

interface ScreeningProps {
  appointmentID?: string;
}

export const Screening: React.FC<ScreeningProps> = () => {
  const { appointment, isAppointmentLoading } = useAppointmentData();

  const { isLoading: isChartDataLoading } = useChartData({
    requestedFields: {
      observations: {
        _tag: ADDITIONAL_QUESTIONS_META_SYSTEM,
        _search_by: 'encounter',
      },
    },
  });

  const { interactionMode } = useNavigationContext();

  if (isChartDataLoading || isAppointmentLoading) return <CSSLoader />;
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
