import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { PatientNotes as PatientNotesButton } from 'src/features/patient-notes/components/PatientNotes';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { AddendumCard } from '../../shared/components/review-tab/AddendumCard';
import { DischargeButton } from '../../shared/components/review-tab/DischargeButton';
import { DischargeSummaryButton } from '../../shared/components/review-tab/DischargeSummaryButton';
import { MissingCard } from '../../shared/components/review-tab/MissingCard';
import { ReviewAndSignButton } from '../../shared/components/review-tab/ReviewAndSignButton';
import { UnlockAppointmentButton } from '../../shared/components/review-tab/UnlockAppointmentButton';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { ProgressNoteDetails } from '../components/progress-note/ProgressNoteDetails';

interface PatientInfoProps {
  appointmentID?: string;
}

export const ProgressNote: React.FC<PatientInfoProps> = () => {
  const {
    resources: { appointment, patient },
    isAppointmentLoading,
    appointmentError,
    refetch,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  if (isLoading || isChartDataLoading) return <Loader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        label="Review & Sign"
        showIntakeNotesButton={false}
        actions={<PatientNotesButton patientId={patient?.id} />}
      />
      <MissingCard />

      <ProgressNoteDetails />

      <AddendumCard />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <DischargeSummaryButton appointmentId={appointment?.id} patientId={patient?.id} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <DischargeButton />
          <ReviewAndSignButton onSigned={refetch} />
          <UnlockAppointmentButton />
        </Box>
      </Box>
    </Stack>
  );
};
