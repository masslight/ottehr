import { Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { Loader } from '../../shared/components/Loader';
import { MedicalHistoryDoubleCard } from '../../shared/components/medical-history-tab';
import { MedicalConditionsPatientColumn } from '../../shared/components/medical-history-tab/MedicalConditions/MedicalConditionsPatientColumn';
import { MedicalConditionsProviderColumn } from '../../shared/components/medical-history-tab/MedicalConditions/MedicalConditionsProviderColumn';
import { PageTitle } from '../../shared/components/PageTitle';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { InfoAlert } from '../components/InfoAlert';
import { MedicalConditionsNotes } from '../components/medical-conditions/MedicalConditionsNotes';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
interface MedicalConditionsProps {
  appointmentID?: string;
}

export const MedicalConditions: FC<MedicalConditionsProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;
  const { interactionMode } = useInPersonNavigationContext();

  if (isLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        dataTestId={dataTestIds.medicalConditions.medicalConditionsPageTitle}
        label="Medical Conditions"
        showIntakeNotesButton={interactionMode === 'intake'}
      />
      <InfoAlert text="Ask: Does the patient have any significant past or ongoing medical issues?" />
      <MedicalHistoryDoubleCard
        label="Medical conditions"
        patientSide={<MedicalConditionsPatientColumn />}
        patientSideLabel="Patient provided"
        providerSide={<MedicalConditionsProviderColumn />}
        providerSideLabel="Healthcare staff input"
      />
      <MedicalConditionsNotes />
    </Stack>
  );
};
