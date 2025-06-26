import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { CSSLoader } from '../components/CSSLoader';
import GeneralInfoCard from '../components/patient-info/GeneralInfoCard';
import VitalsNotesCard from '../components/patient-info/VitalsNotesCard';
import VitalsWeightsCard from '../components/vitals/weights/VitalsWeightsCard';
import { useAppointment } from '../hooks/useAppointment';

interface PatientInfoProps {
  appointmentID?: string;
}

export const PatientInfo: React.FC<PatientInfoProps> = () => {
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
    <Stack spacing={1}>
      <PageTitle label="General Info" />
      <GeneralInfoCard />
      <VitalsWeightsCard />
      <VitalsNotesCard />
    </Stack>
  );
};
