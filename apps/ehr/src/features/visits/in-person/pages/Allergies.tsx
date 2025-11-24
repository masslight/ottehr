import { Stack, Typography } from '@mui/material';
import React from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { KnownAllergiesPatientColumn } from '../../shared/components/known-allergies/KnownAllergiesPatientColumn';
import { KnownAllergiesProviderColumn } from '../../shared/components/known-allergies/KnownAllergiesProviderColumn';
import { Loader } from '../../shared/components/Loader';
import { MedicalHistoryDoubleCard } from '../../shared/components/medical-history-tab';
import { PageTitle } from '../../shared/components/PageTitle';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { AllergiesNotes } from '../components/allergies/AllergiesNotes';
import { InfoAlert } from '../components/InfoAlert';
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

  if (isAppointmentLoading || isChartDataLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        dataTestId={dataTestIds.allergies.allergiesPageTitle}
        label="Allergies"
        showIntakeNotesButton={interactionMode === 'main'}
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
