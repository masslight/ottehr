import { Stack, Typography } from '@mui/material';
import React from 'react';
import { KnownAllergiesPatientColumn, KnownAllergiesProviderColumn } from 'src/components/KnownAllergies';
import { MedicalHistoryDoubleCard } from 'src/components/MedicalHistoryTab';
import { useAppointmentData, useChartData } from 'src/shared/hooks/appointment/appointment.store';
import { PageTitle } from '../../../components/PageTitle';
import { dataTestIds } from '../../../constants/data-test-ids';
import { AllergiesNotes } from '../components/allergies/AllergiesNotes';
import { InfoAlert } from '../components/InfoAlert';
import { InPersonLoader } from '../components/InPersonLoader';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
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
  const { interactionMode } = useInPersonNavigationContext();
  const error = chartDataError || appointmentError;

  if (isAppointmentLoading || isChartDataLoading) return <InPersonLoader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        dataTestId={dataTestIds.allergies.allergiesPageTitle}
        label="Allergies"
        showIntakeNotesButton={interactionMode === 'intake'}
      />
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
