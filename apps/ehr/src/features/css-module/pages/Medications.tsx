import { Box, Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import {
  CurrentMedicationsPatientColumn,
  CurrentMedicationsProviderColumn,
  MedicalHistoryDoubleCard,
} from '../../../telemed/features/appointment';
import { CSSLoader } from '../components/CSSLoader';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { AskMedicationsAlert } from '../components/medications/AskMedicationsAlert';
import { useAppointment } from '../hooks/useAppointment';

interface MedicationsProps {
  appointmentID?: string;
}

export const Medications: React.FC<MedicationsProps> = () => {
  const { id: appointmentID } = useParams();
  const {
    sourceData: { appointment },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <>
      <Box display={'flex'} flexDirection={'column'} gap={2} mt={2}>
        <AskMedicationsAlert />
        <MedicalHistoryDoubleCard
          patientSide={<CurrentMedicationsPatientColumn />}
          providerSide={<CurrentMedicationsProviderColumn />}
        />

        <MedicationHistoryList />
      </Box>
    </>
  );
};
