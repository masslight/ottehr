import { Stack, Typography } from '@mui/material';
import React from 'react';
import { Loader } from '../../shared/components/Loader';
import { MedicalHistoryDoubleCard } from '../../shared/components/medical-history-tab';
import { CurrentMedicationsPatientColumn } from '../../shared/components/medical-history-tab/CurrentMedications/CurrentMedicationsPatientColumn';
import { CurrentMedicationsProviderColumn } from '../../shared/components/medical-history-tab/CurrentMedications/CurrentMedicationsProviderColumn';
import { PageTitle } from '../../shared/components/PageTitle';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
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

  if (isLoading || isChartDataLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Medications" showIntakeNotesButton={interactionMode === 'main'} />

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
