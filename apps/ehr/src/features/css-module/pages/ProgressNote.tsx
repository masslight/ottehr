import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import {
  AccordionCard,
  DoubleColumnContainer,
  useAppointmentStore,
  useGetAppointmentAccessibility,
} from '../../../telemed';
import { ChiefComplaintCard } from '../../../telemed/features/appointment';
import { MissingCard, ReviewAndSignButton, SendFaxButton } from '../../../telemed/features/appointment/ReviewTab';
import { CSSLoader } from '../components/CSSLoader';
import { PatientInformationContainer } from '../components/progress-note/PatientInformationContainer';
import { ProgressNoteDetails } from '../components/progress-note/ProgressNoteDetails';
import { VisitDetailsContainer } from '../components/progress-note/VisitDetailsContainer';
import { useAppointment } from '../hooks/useAppointment';
import { IntakeNotes } from '../hooks/useIntakeNotes';
import { PageTitle } from '../../../telemed/components/PageTitle';

interface PatientInfoProps {
  appointmentID?: string;
}

export const ProgressNote: React.FC<PatientInfoProps> = () => {
  const { id: appointmentID } = useParams();
  const {
    resources: { appointment },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  if (isLoading || isChartDataLoading) return <CSSLoader />;
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

      <ChiefComplaintCard />

      <ProgressNoteDetails />

      {!isReadOnly && (
        <Box sx={{ display: 'flex', justifyContent: 'end', gap: 1 }}>
          <SendFaxButton />
          <ReviewAndSignButton />
        </Box>
      )}
    </Stack>
  );
};
