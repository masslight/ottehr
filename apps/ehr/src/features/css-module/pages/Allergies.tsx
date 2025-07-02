import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import {
  KnownAllergiesPatientColumn,
  KnownAllergiesProviderColumn,
  MedicalHistoryDoubleCard,
} from '../../../telemed/features/appointment';
import { CSSLoader } from '../components/CSSLoader';
import { InfoAlert } from '../components/InfoAlert';
import { useNavigationContext } from '../context/NavigationContext';
import { useAppointment } from '../hooks/useAppointment';

interface AllergiesProps {
  appointmentID?: string;
}

export const Allergies: React.FC<AllergiesProps> = () => {
  const { id: appointmentID } = useParams();
  const {
    resources: { appointment },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  const { interactionMode } = useNavigationContext();

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Allergies" showIntakeNotesButton={interactionMode === 'intake'} />
      <Box sx={{ display: 'flex', flexDirection: 'column', mt: 3, gap: 3 }}>
        <InfoAlert text="Ask: Does the patient have any known allergies to medications, latex, or food?" />
        <MedicalHistoryDoubleCard
          patientSide={<KnownAllergiesPatientColumn />}
          patientSideLabel="Patient provided"
          providerSide={<KnownAllergiesProviderColumn />}
          providerSideLabel="Healthcare staff input"
        />
      </Box>
    </Stack>
  );
};
