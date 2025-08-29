import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useAppointmentData, useChartData } from 'src/telemed';
import { dataTestIds } from '../../../constants/data-test-ids';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { MedicalHistoryDoubleCard } from '../../../telemed/features/appointment';
import { CSSLoader } from '../components/CSSLoader';
import { HospitalizationForm } from '../components/hospitalization/HospitalizationForm';
import { HospitalizationNotes } from '../components/hospitalization/HospitalizationNotes';
import { HospitalizationPatientComponent } from '../components/hospitalization/HospitalizationPatientComponent';
import { InfoAlert } from '../components/InfoAlert';
import { useNavigationContext } from '../context/NavigationContext';
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
  const { interactionMode } = useNavigationContext();

  if (isLoading) return <CSSLoader />;
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
