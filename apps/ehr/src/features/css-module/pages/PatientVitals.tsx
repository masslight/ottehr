import { Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { CSSLoader } from '../components/CSSLoader';
import VitalsNotesCard from '../components/patient-info/VitalsNotesCard';
import VitalsBloodPressureCard from '../components/vitals/blood-pressure/VitalsBloodPressureCard';
import VitalsHeartbeatCard from '../components/vitals/heartbeat/VitalsHeartbeatCard';
import VitalsHeightCard from '../components/vitals/heights/VitalsHeightCard';
import VitalsOxygenSatCard from '../components/vitals/oxygen-saturation/VitalsOxygenSatCard';
import VitalsRespirationRateCard from '../components/vitals/respiration-rate/VitalsRespirationRateCard';
import VitalsTemperaturesCard from '../components/vitals/temperature/VitalsTemperaturesCard';
import VitalsVisionCard from '../components/vitals/vision/VitalsVisionCard';
import VitalsWeightsCard from '../components/vitals/weights/VitalsWeightsCard';
import { useAppointment } from '../hooks/useAppointment';

interface PatientVitalsProps {
  appointmentID?: string;
}

export const PatientVitals: React.FC<PatientVitalsProps> = () => {
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
    <>
      <VitalsTemperaturesCard />
      <VitalsHeartbeatCard />
      <VitalsRespirationRateCard />
      <VitalsBloodPressureCard />
      <VitalsOxygenSatCard />
      <VitalsWeightsCard />
      <VitalsHeightCard />
      <VitalsVisionCard />
      <VitalsNotesCard />
    </>
  );
};
