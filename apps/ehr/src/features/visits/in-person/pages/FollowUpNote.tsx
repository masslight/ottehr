import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { AddendumCard } from '../../shared/components/review-tab/AddendumCard';
import { ReviewAndSignButton } from '../../shared/components/review-tab/ReviewAndSignButton';
import { SendFaxButton } from '../../shared/components/review-tab/SendFaxButton';
import { UnlockAppointmentButton } from '../../shared/components/review-tab/UnlockAppointmentButton';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { useAppFlags } from '../../shared/stores/contexts/useAppFlags';
import { FollowUpNoteDetails } from '../components/follow-up-note/FollowUpNoteDetails';
import { FollowUpSummaryCard } from '../components/follow-up-note/FollowUpSummaryCard';

interface FollowUpNoteProps {
  appointmentID?: string;
}

export const FollowUpNote: React.FC<FollowUpNoteProps> = () => {
  const {
    appointment: appointmentResource,
    encounter,
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
    refetch,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;
  const { isInPerson } = useAppFlags();

  if (isLoading || isChartDataLoading) return <Loader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Follow-up Note" showIntakeNotesButton={false} />

      <FollowUpSummaryCard />

      <FollowUpNoteDetails />

      <AddendumCard />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <SendFaxButton appointment={appointmentResource} encounter={encounter} inPerson={isInPerson} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ReviewAndSignButton onSigned={refetch} />
          <UnlockAppointmentButton />
        </Box>
      </Box>
    </Stack>
  );
};
