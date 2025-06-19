import { Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { useParams } from 'react-router-dom';
import { CSSLoader } from 'src/features/css-module/components/CSSLoader';
import VitalsNotesCard from 'src/features/css-module/components/patient-info/VitalsNotesCard';
import VitalsBloodPressureCard from 'src/features/css-module/components/vitals/blood-pressure/VitalsBloodPressureCard';
import VitalsHeartbeatCard from 'src/features/css-module/components/vitals/heartbeat/VitalsHeartbeatCard';
import VitalsHeightCard from 'src/features/css-module/components/vitals/heights/VitalsHeightCard';
import VitalsOxygenSatCard from 'src/features/css-module/components/vitals/oxygen-saturation/VitalsOxygenSatCard';
import VitalsRespirationRateCard from 'src/features/css-module/components/vitals/respiration-rate/VitalsRespirationRateCard';
import VitalsTemperaturesCard from 'src/features/css-module/components/vitals/temperature/VitalsTemperaturesCard';
import VitalsVisionCard from 'src/features/css-module/components/vitals/vision/VitalsVisionCard';
import VitalsWeightsCard from 'src/features/css-module/components/vitals/weights/VitalsWeightsCard';
import { useNavigationContext } from 'src/features/css-module/context/NavigationContext';
import { useAppointment } from 'src/features/css-module/hooks/useAppointment';
import { PageTitle } from 'src/telemed/components/PageTitle';
import { useAppointmentStore } from 'src/telemed/state';
import { getSelectors } from 'utils';

export const VitalsTab: FC = () => {
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
      <PageTitle label="Vitals" showIntakeNotesButton={interactionMode === 'intake'} />
      <VitalsTemperaturesCard />
      <VitalsHeartbeatCard />
      <VitalsRespirationRateCard />
      <VitalsBloodPressureCard />
      <VitalsOxygenSatCard />
      <VitalsWeightsCard />
      <VitalsHeightCard />
      <VitalsVisionCard />
      <VitalsNotesCard />
    </Stack>
  );
};
