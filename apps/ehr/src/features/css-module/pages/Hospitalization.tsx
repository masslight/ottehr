import React from 'react';
import { Typography, Stack } from '@mui/material';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { InfoAlert } from '../components/InfoAlert';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { CSSLoader } from '../components/CSSLoader';
import { useAppointment } from '../hooks/useAppointment';
import { MedicalHistoryDoubleCard } from '../../../telemed/features/appointment';
import { HospitalizationPatientComponent } from '../components/hospitalization/HospitalizationPatientComponent';
import { HospitalizationForm } from '../components/hospitalization/HospitalizationForm';

interface HospitalizationProps {
  appointmentID?: string;
}

export const Hospitalization: React.FC<HospitalizationProps> = () => {
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
    <Stack spacing={2}>
      <PageTitle label="Hospitalization" />
      <InfoAlert text="Ask: Has the patient had any prior overnight hospital stays or hospital admissions?" />
      <MedicalHistoryDoubleCard
        patientSide={<HospitalizationPatientComponent />}
        patientSideLabel="Patient provided"
        providerSide={<HospitalizationForm />}
        providerSideLabel="Clinical support input"
      />
    </Stack>
  );
};
