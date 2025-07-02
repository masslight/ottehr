import { Box, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import {
  MedicalConditionsPatientColumn,
  MedicalConditionsProviderColumn,
  MedicalHistoryDoubleCard,
} from '../../../telemed/features/appointment';
import { CSSLoader } from '../components/CSSLoader';
import { InfoAlert } from '../components/InfoAlert';
import { useNavigationContext } from '../context/NavigationContext';
import { useAppointment } from '../hooks/useAppointment';

interface MedicalConditionsProps {
  appointmentID?: string;
}

export const MedicalConditions: FC<MedicalConditionsProps> = () => {
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
      <PageTitle label="Medical Conditions" showIntakeNotesButton={interactionMode === 'intake'} />
      <Box sx={{ display: 'flex', flexDirection: 'column', mt: 3, gap: 3 }}>
        <InfoAlert text="Ask: Does the patient have any significant past or ongoing medical issues?" />
        <MedicalHistoryDoubleCard
          label="Medical conditions"
          patientSide={<MedicalConditionsPatientColumn />}
          patientSideLabel="Patient provided"
          providerSide={<MedicalConditionsProviderColumn />}
          providerSideLabel="Healthcare staff input"
        />
      </Box>
    </Stack>
  );
};
