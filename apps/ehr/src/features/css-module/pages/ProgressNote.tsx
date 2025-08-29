import { Box, Grid, Stack, Typography } from '@mui/material';
import React from 'react';
import {
  AccordionCard,
  DoubleColumnContainer,
  useAppointmentData,
  useChartData,
  useGetAppointmentAccessibility,
} from '../../../telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { ChiefComplaintCard } from '../../../telemed/features/appointment';
import {
  AddendumCard,
  DischargeButton,
  DischargeSummaryButton,
  MissingCard,
  ReviewAndSignButton,
  SendFaxButton,
} from '../../../telemed/features/appointment/ReviewTab';
import { CSSLoader } from '../components/CSSLoader';
import { PatientInformationContainer } from '../components/progress-note/PatientInformationContainer';
import { ProgressNoteDetails } from '../components/progress-note/ProgressNoteDetails';
import { RecordAudioButton } from '../components/progress-note/RecordAudioButton';
import { VisitDetailsContainer } from '../components/progress-note/VisitDetailsContainer';
import { useFeatureFlags } from '../context/featureFlags';
import { IntakeNotes } from '../hooks/useIntakeNotes';

interface PatientInfoProps {
  appointmentID?: string;
}

export const ProgressNote: React.FC<PatientInfoProps> = () => {
  const {
    appointment: appointmentResource,
    encounter,
    resources: { appointment, patient },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { css } = useFeatureFlags();

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;
  if (!encounter.id) return <Typography>Encounter ID is undefined</Typography>;

  return (
    <Stack spacing={1}>
      <Grid container>
        <Grid item xs={6}>
          <PageTitle label="Progress Note" showIntakeNotesButton={false} />
        </Grid>
        <Grid item xs={6} sx={{ textAlign: 'right' }}>
          <RecordAudioButton visitID={encounter.id} />
          {/* <WavesurferPlayer height={100} waveColor="violet" ></WavesurferPlayer> */}
          {/* <ButtonRounded variant="outlined" startIcon={isRecording ? <MicOff /> : <Mic />} onClick={() => recordAudio(mediaRecorder, mediaChunks, isRecording)}>{isRecording ? 'Stop' : 'Start'} Recording</ButtonRounded> */}
        </Grid>
      </Grid>
      <MissingCard />

      <AccordionCard>
        <DoubleColumnContainer
          divider
          padding
          leftColumn={<PatientInformationContainer />}
          rightColumn={<VisitDetailsContainer />}
        />
      </AccordionCard>

      <AccordionCard label="Intake Notes">
        <IntakeNotes />
      </AccordionCard>

      <ChiefComplaintCard />

      <ProgressNoteDetails />

      <AddendumCard />

      {!isReadOnly && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <SendFaxButton appointment={appointmentResource} encounter={encounter} css={css} />
            <DischargeSummaryButton appointmentId={appointment?.id} patientId={patient?.id} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <DischargeButton />
            <ReviewAndSignButton />
          </Box>
        </Box>
      )}
    </Stack>
  );
};
