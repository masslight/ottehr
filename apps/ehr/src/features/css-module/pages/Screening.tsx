import { Typography } from '@mui/material';
import React from 'react';
import { ADDITIONAL_QUESTIONS_META_SYSTEM } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { CSSLoader } from '../components/CSSLoader';
import AskThePatient from '../components/screening/AskThePatient';
import { ASQ } from '../components/screening/ASQ';
import { Questions } from '../components/screening/PaperworkAndConfirmedQuestions';
import { ScreeningNotes } from '../components/screening/ScreeningNotes';
import { useChartData } from '../hooks/useChartData';

interface ScreeningProps {
  appointmentID?: string;
}

export const Screening: React.FC<ScreeningProps> = () => {
  const { isChartDataLoading, appointment, isAppointmentLoading, encounter } = getSelectors(useAppointmentStore, [
    'isChartDataLoading',
    'appointment',
    'isAppointmentLoading',
    'encounter',
  ]);

  useChartData({
    encounterId: encounter?.id || '',
    requestedFields: {
      observations: {
        _tag: ADDITIONAL_QUESTIONS_META_SYSTEM,
        _search_by: 'encounter',
      },
    },
  });

  if (isChartDataLoading || isAppointmentLoading) return <CSSLoader />;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <>
      <Questions />
      <AskThePatient />
      <ASQ />
      <ScreeningNotes />
    </>
  );
};
