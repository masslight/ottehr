import React from 'react';
import { Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { useAppointment } from '../hooks/useAppointment';
import AskThePatient from '../components/screening/AskThePatient';
import { Questions } from '../components/screening/PaperworkAndConfirmedQuestions';
import { CSSLoader } from '../components/CSSLoader';
import { ASQ } from '../components/screening/ASQ';
import { ScreeningNotes } from '../components/screening/ScreeningNotes';

interface ScreeningProps {
  appointmentID?: string;
}

export const Screening: React.FC<ScreeningProps> = () => {
  const { id: appointmentID } = useParams();
  const {
    sourceData: { appointment },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
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
