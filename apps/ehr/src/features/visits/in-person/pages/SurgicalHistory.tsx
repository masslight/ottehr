import { Stack, Typography } from '@mui/material';
import React from 'react';
import { Loader } from '../../shared/components/Loader';
import { MedicalHistoryDoubleCard } from '../../shared/components/medical-history-tab';
import { SurgicalHistoryPatientColumn } from '../../shared/components/medical-history-tab/SurgicalHistory/SurgicalHistoryPatientColumn';
import { SurgicalHistoryProviderColumn } from '../../shared/components/medical-history-tab/SurgicalHistory/SurgicalHistoryProviderColumn';
import { PageTitle } from '../../shared/components/PageTitle';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { InfoAlert } from '../components/InfoAlert';
import { SurgicalHistoryNotes } from '../components/surgical-history/SurgicalHistoryNotes';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
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
  const { interactionMode } = useInPersonNavigationContext();

  if (isLoading || isChartDataLoading) return <Loader />;
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
