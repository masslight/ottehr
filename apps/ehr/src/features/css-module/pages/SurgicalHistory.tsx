import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useAppointmentData, useChartData } from 'src/telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import {
  MedicalHistoryDoubleCard,
  SurgicalHistoryPatientColumn,
  SurgicalHistoryProviderColumn,
} from '../../../telemed/features/appointment';
import { CSSLoader } from '../components/CSSLoader';
import { InfoAlert } from '../components/InfoAlert';
import { SurgicalHistoryNotes } from '../components/surgical-history/SurgicalHistoryNotes';
import { useNavigationContext } from '../context/NavigationContext';
interface SurgicalHistoryProps {
  appointmentID?: string;
}

export const SurgicalHistory: React.FC<SurgicalHistoryProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;
  const { interactionMode } = useNavigationContext();

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Surgical History" showIntakeNotesButton={interactionMode === 'intake'} />
      <InfoAlert text="Ask: Has the patient ever had surgery? If yes, what was the surgery?" />
      <MedicalHistoryDoubleCard
        patientSide={<SurgicalHistoryPatientColumn />}
        patientSideLabel="Patient provided"
        providerSide={<SurgicalHistoryProviderColumn />}
        providerSideLabel="Healthcare staff input"
      />
      <SurgicalHistoryNotes />
    </Stack>
  );
};
