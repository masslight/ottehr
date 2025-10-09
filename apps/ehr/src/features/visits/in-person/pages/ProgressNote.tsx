import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { ApplyTemplate } from 'src/features/visits/shared/components/templates/ApplyTemplate';
import { FEATURE_FLAGS } from '../../../../constants/feature-flags';
import { Loader } from '../../shared/components/Loader';
import { ChiefComplaintCard } from '../../shared/components/medical-history-tab';
import { PageTitle } from '../../shared/components/PageTitle';
import { AddendumCard } from '../../shared/components/review-tab/AddendumCard';
import { DischargeButton } from '../../shared/components/review-tab/DischargeButton';
import { DischargeSummaryButton } from '../../shared/components/review-tab/DischargeSummaryButton';
import { MissingCard } from '../../shared/components/review-tab/MissingCard';
import { ReviewAndSignButton } from '../../shared/components/review-tab/ReviewAndSignButton';
import { SendFaxButton } from '../../shared/components/review-tab/SendFaxButton';
import { UnlockAppointmentButton } from '../../shared/components/review-tab/UnlockAppointmentButton';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { useAppFlags } from '../../shared/stores/contexts/useAppFlags';
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

  if (isLoading || isChartDataLoading) return <Loader />;
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
