import React from 'react';
import { Typography, Stack } from '@mui/material';
import { useParams } from 'react-router-dom';
import { MissingCard, ReviewAndSignButton } from '../../../telemed/features/appointment/ReviewTab';
import { getSelectors } from '../../../shared/store/getSelectors';
import {
  AccordionCard,
  DoubleColumnContainer,
  useAppointmentStore,
  useGetAppointmentAccessibility,
} from '../../../telemed';
import { useAppointment } from '../hooks/useAppointment';
import { CSSLoader } from '../components/CSSLoader';
import { PatientInformationContainer } from '../components/progress-note/PatientInformationContainer';
import { VisitDetailsContainer } from '../components/progress-note/VisitDetailsContainer';
import { InternalNotes } from '../hooks/useInternalNotes';
import { ProgressNoteDetails } from '../components/progress-note/ProgressNoteDetails';
import { ChiefComplaintCard } from '../../../telemed/features/appointment';

interface PatientInfoProps {
  appointmentID?: string;
}

export const ProgressNote: React.FC<PatientInfoProps> = () => {
  const { id: appointmentID } = useParams();
  const {
    sourceData: { appointment },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={2}>
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
        <InternalNotes />
      </AccordionCard>

      <ChiefComplaintCard />

      <ProgressNoteDetails />

      {!isReadOnly && <ReviewAndSignButton />}
    </Stack>
  );
};
