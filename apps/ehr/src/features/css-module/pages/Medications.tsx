import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
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
import { useAppointment } from '../hooks/useAppointment';

interface MedicationsProps {
  appointmentID?: string;
}

export const Medications: React.FC<MedicationsProps> = () => {
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
