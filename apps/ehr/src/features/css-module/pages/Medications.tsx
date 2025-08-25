import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useAppointmentData, useChartData } from 'src/telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import {
  CurrentMedicationsPatientColumn,
  CurrentMedicationsProviderColumn,
  MedicalHistoryDoubleCard,
} from '../../../telemed/features/appointment';
import { CSSLoader } from '../components/CSSLoader';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { AskMedicationsAlert } from '../components/medications/AskMedicationsAlert';
import { MedicationsNotes } from '../components/medications/MedicationsNotes';
import { useNavigationContext } from '../context/NavigationContext';
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

  const { interactionMode } = useNavigationContext();

  if (isLoading || isChartDataLoading) return <CSSLoader />;
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
