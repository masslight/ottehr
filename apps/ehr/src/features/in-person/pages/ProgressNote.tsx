import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { ApplyTemplate } from 'src/components/ApplyTemplate';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { ChiefComplaintCard } from 'src/components/MedicalHistoryTab';
import {
  AddendumCard,
  DischargeButton,
  DischargeSummaryButton,
  MissingCard,
  ReviewAndSignButton,
  SendFaxButton,
  UnlockAppointmentButton,
} from 'src/components/ReviewTab';
import { useAppFlags } from 'src/shared/contexts/useAppFlags';
import { useAppointmentData, useChartData } from 'src/shared/hooks/appointment/appointment.store';
import { PageTitle } from '../../../components/PageTitle';
import { FEATURE_FLAGS } from '../../../constants/feature-flags';
import { InPersonLoader } from '../components/InPersonLoader';
import { PatientInformationContainer } from '../components/progress-note/PatientInformationContainer';
import { ProgressNoteDetails } from '../components/progress-note/ProgressNoteDetails';
import { VisitDetailsContainer } from '../components/progress-note/VisitDetailsContainer';
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
    refetch,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;
  const { isInPerson } = useAppFlags();

  if (isLoading || isChartDataLoading) return <InPersonLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Progress Note" showIntakeNotesButton={false} />
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

      {FEATURE_FLAGS.GLOBAL_TEMPLATES_ENABLED && (
        <AccordionCard label="Apply Template">
          <ApplyTemplate />
        </AccordionCard>
      )}

      <ChiefComplaintCard />

      <ProgressNoteDetails />

      <AddendumCard />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <SendFaxButton appointment={appointmentResource} encounter={encounter} inPerson={isInPerson} />
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
