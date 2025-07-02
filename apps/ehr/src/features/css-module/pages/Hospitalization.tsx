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
import { HospitalizationNotes } from '../components/hospitalization/HospitalizationNotes';
import { HospitalizationPatientComponent } from '../components/hospitalization/HospitalizationPatientComponent';
import { InfoAlert } from '../components/InfoAlert';
import { useNavigationContext } from '../context/NavigationContext';
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

  const { interactionMode } = useNavigationContext();

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
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
