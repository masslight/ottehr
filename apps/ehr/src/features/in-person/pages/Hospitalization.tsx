import { Stack, Typography } from '@mui/material';
import React from 'react';
import { MedicalHistoryDoubleCard } from 'src/components/MedicalHistoryTab';
import { useAppointmentData, useChartData } from 'src/shared/hooks/appointment/appointment.store';
import { PageTitle } from '../../../components/PageTitle';
import { dataTestIds } from '../../../constants/data-test-ids';
import { HospitalizationForm } from '../components/hospitalization/HospitalizationForm';
import { HospitalizationNotes } from '../components/hospitalization/HospitalizationNotes';
import { HospitalizationPatientComponent } from '../components/hospitalization/HospitalizationPatientComponent';
import { InfoAlert } from '../components/InfoAlert';
import { InPersonLoader } from '../components/InPersonLoader';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
interface HospitalizationProps {
  appointmentID?: string;
}

export const Hospitalization: React.FC<HospitalizationProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const error = chartDataError || appointmentError;
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const { interactionMode } = useInPersonNavigationContext();

  if (isLoading) return <InPersonLoader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        dataTestId={dataTestIds.hospitalizationPage.hospitalizationTitle}
        label="Hospitalization"
        showIntakeNotesButton={interactionMode === 'intake'}
      />
      <InfoAlert text="Ask: Has the patient had any prior overnight hospital stays or hospital admissions?" />
      <MedicalHistoryDoubleCard
        patientSide={<HospitalizationPatientComponent />}
        patientSideLabel="Patient provided"
        providerSide={<HospitalizationForm />}
        providerSideLabel="Healthcare staff input"
      />
      <HospitalizationNotes />
    </Stack>
  );
};
