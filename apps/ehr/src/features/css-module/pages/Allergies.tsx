import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useAppointmentData, useChartData } from 'src/telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import {
  KnownAllergiesPatientColumn,
  KnownAllergiesProviderColumn,
  MedicalHistoryDoubleCard,
} from '../../../telemed/features/appointment';
import { AllergiesNotes } from '../components/allergies/AllergiesNotes';
import { CSSLoader } from '../components/CSSLoader';
import { InfoAlert } from '../components/InfoAlert';
import { useNavigationContext } from '../context/NavigationContext';
interface AllergiesProps {
  appointmentID?: string;
}

export const Allergies: React.FC<AllergiesProps> = () => {
  const {
    isAppointmentLoading,
    resources: { appointment },
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const { interactionMode } = useNavigationContext();
  const error = chartDataError || appointmentError;

  if (isAppointmentLoading || isChartDataLoading) return <CSSLoader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Allergies" showIntakeNotesButton={interactionMode === 'intake'} />
      <InfoAlert text="Ask: Does the patient have any known allergies to medications, latex, or food?" />
      <MedicalHistoryDoubleCard
        patientSide={<KnownAllergiesPatientColumn />}
        patientSideLabel="Patient provided"
        providerSide={<KnownAllergiesProviderColumn />}
        providerSideLabel="Healthcare staff input"
      />
      <AllergiesNotes />
    </Stack>
  );
};
