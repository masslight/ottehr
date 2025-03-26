import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import {
  MedicalHistoryDoubleCard,
  SurgicalHistoryPatientColumn,
  SurgicalHistoryProviderColumn,
} from '../../../telemed/features/appointment';
import { CSSLoader } from '../components/CSSLoader';
import { InfoAlert } from '../components/InfoAlert';
import { useAppointment } from '../hooks/useAppointment';

interface SurgicalHistoryProps {
  appointmentID?: string;
}

export const SurgicalHistory: React.FC<SurgicalHistoryProps> = () => {
  const { id: appointmentID } = useParams();

  const {
    resources: { appointment },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={2}>
      <PageTitle label="Surgical History" />
      <InfoAlert text="Ask: Has the patient ever had surgery? If yes, what was the surgery?" />
      <MedicalHistoryDoubleCard
        patientSide={<SurgicalHistoryPatientColumn />}
        patientSideLabel="Patient provided"
        providerSide={<SurgicalHistoryProviderColumn />}
        providerSideLabel="Clinical support input"
      />
    </Stack>
  );
};
