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
import { PageTitle } from '../../../telemed/components/PageTitle';
import { ChiefComplaintCard } from '../../../telemed/features/appointment';
import {
  AddendumCard,
  DischargeButton,
  MissingCard,
  ReviewAndSignButton,
  SendFaxButton,
} from '../../../telemed/features/appointment/ReviewTab';
import { CSSLoader } from '../components/CSSLoader';
import { PatientInformationContainer } from '../components/progress-note/PatientInformationContainer';
import { ProgressNoteDetails } from '../components/progress-note/ProgressNoteDetails';
import { VisitDetailsContainer } from '../components/progress-note/VisitDetailsContainer';
import { useFeatureFlags } from '../context/featureFlags';
import { useAppointment } from '../hooks/useAppointment';
import { IntakeNotes } from '../hooks/useIntakeNotes';

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

  const {
    appointment: appointmentResource,
    encounter,
    isChartDataLoading,
  } = getSelectors(useAppointmentStore, ['appointment', 'encounter', 'isChartDataLoading']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { css } = useFeatureFlags();

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

      <AddendumCard />

      {!isReadOnly && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <SendFaxButton appointment={appointmentResource} encounter={encounter} css={css} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <DischargeButton />
            <ReviewAndSignButton />
          </Box>
        </Box>
      )}
    </Stack>
  );
};
