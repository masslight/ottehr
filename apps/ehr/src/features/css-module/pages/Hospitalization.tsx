import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import { dataTestIds } from '../../../constants/data-test-ids';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { MedicalHistoryDoubleCard } from '../../../telemed/features/appointment';
import { CSSLoader } from '../components/CSSLoader';
import { HospitalizationForm } from '../components/hospitalization/HospitalizationForm';
import { HospitalizationPatientComponent } from '../components/hospitalization/HospitalizationPatientComponent';
import { InfoAlert } from '../components/InfoAlert';
import { useAppointment } from '../hooks/useAppointment';

interface HospitalizationProps {
  appointmentID?: string;
}

export const Hospitalization: React.FC<HospitalizationProps> = () => {
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
      <PageTitle dataTestId={dataTestIds.hospitalizationPage.hospitalizationTitle} label="Hospitalization" />
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
