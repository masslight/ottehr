import React, { FC } from 'react';
import { Typography, Box } from '@mui/material';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { useAppointment } from '../hooks/useAppointment';
import { CSSLoader } from '../components/CSSLoader';
import { InfoAlert } from '../components/InfoAlert';
import {
  MedicalConditionsPatientColumn,
  MedicalConditionsProviderColumn,
  MedicalHistoryDoubleCard,
} from '../../../telemed/features/appointment';

interface MedicalConditionsProps {
  appointmentID?: string;
}

export const MedicalConditions: FC<MedicalConditionsProps> = () => {
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
    <Box sx={{ display: 'flex', flexDirection: 'column', mt: 3, gap: 3 }}>
      <InfoAlert text="Ask: Does the patient have any significant past or ongoing medical issues?" />
      <MedicalHistoryDoubleCard
        label="Medical conditions"
        patientSide={<MedicalConditionsPatientColumn />}
        patientSideLabel="Patient provided"
        providerSide={<MedicalConditionsProviderColumn />}
        providerSideLabel="Clinical support input"
      />
    </Box>
  );
};
