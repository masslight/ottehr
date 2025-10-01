import { Stack, Typography } from '@mui/material';
import React from 'react';
import {
  CurrentMedicationsPatientColumn,
  CurrentMedicationsProviderColumn,
  MedicalHistoryDoubleCard,
} from 'src/components/MedicalHistoryTab';
import { useAppointmentData, useChartData } from 'src/shared/hooks/appointment/appointment.store';
import { PageTitle } from '../../../components/PageTitle';
import { InPersonLoader } from '../components/InPersonLoader';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { AskMedicationsAlert } from '../components/medications/AskMedicationsAlert';
import { MedicationsNotes } from '../components/medications/MedicationsNotes';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
interface MedicationsProps {
  appointmentID?: string;
}

export const Medications: React.FC<MedicationsProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  const { interactionMode } = useInPersonNavigationContext();

  if (isLoading || isChartDataLoading) return <InPersonLoader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Medications" showIntakeNotesButton={interactionMode === 'intake'} />

      <AskMedicationsAlert />
      <MedicalHistoryDoubleCard
        patientSide={<CurrentMedicationsPatientColumn />}
        providerSide={<CurrentMedicationsProviderColumn />}
      />

      <MedicationHistoryList />
      <MedicationsNotes />
    </Stack>
  );
};
