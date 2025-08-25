import { Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { useAppointmentData, useChartData } from 'src/telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import {
  MedicalConditionsPatientColumn,
  MedicalConditionsProviderColumn,
  MedicalHistoryDoubleCard,
} from '../../../telemed/features/appointment';
import { CSSLoader } from '../components/CSSLoader';
import { InfoAlert } from '../components/InfoAlert';
import { MedicalConditionsNotes } from '../components/medical-conditions/MedicalConditionsNotes';
import { useNavigationContext } from '../context/NavigationContext';
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
  const { interactionMode } = useNavigationContext();

  if (isLoading) return <CSSLoader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Medical Conditions" showIntakeNotesButton={interactionMode === 'intake'} />
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
