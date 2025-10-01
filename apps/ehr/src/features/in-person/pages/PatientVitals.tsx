import { Stack, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { useAppointmentData, useChartData } from 'src/shared/hooks/appointment/appointment.store';
import { getAbnormalVitals, VitalFieldNames, VitalsObservationDTO } from 'utils';
import { PageTitle } from '../../../components/PageTitle';
import { AbnormalVitalsModal } from '../components/AbnormalVitalsModal';
import { InPersonLoader } from '../components/InPersonLoader';
import VitalsNotesCard from '../components/patient-info/VitalsNotesCard';
import VitalsBloodPressureCard from '../components/vitals/blood-pressure/VitalsBloodPressureCard';
import VitalsHeartbeatCard from '../components/vitals/heartbeat/VitalsHeartbeatCard';
import VitalsHeightCard from '../components/vitals/heights/VitalsHeightCard';
import { useDeleteVitals } from '../components/vitals/hooks/useDeleteVitals';
import { useGetHistoricalVitals, useGetVitals } from '../components/vitals/hooks/useGetVitals';
import { useSaveVitals } from '../components/vitals/hooks/useSaveVitals';
import VitalsOxygenSatCard from '../components/vitals/oxygen-saturation/VitalsOxygenSatCard';
import VitalsRespirationRateCard from '../components/vitals/respiration-rate/VitalsRespirationRateCard';
import VitalsTemperaturesCard from '../components/vitals/temperature/VitalsTemperaturesCard';
import VitalsVisionCard from '../components/vitals/vision/VitalsVisionCard';
import VitalsWeightsCard from '../components/vitals/weights/VitalsWeightsCard';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';

interface PatientVitalsProps {
  appointmentID?: string;
}

export const PatientVitals: React.FC<PatientVitalsProps> = () => {
  const {
    resources: { appointment, encounter },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  const saveVitals = useSaveVitals({ encounterId: encounter?.id ?? '' });
  const deleteVitals = useDeleteVitals({ encounterId: encounter?.id ?? '' });

  const {
    data: encounterVitals,
    isLoading: encounterVitalsLoading,
    refetch: refetchEncounterVitals,
  } = useGetVitals(encounter?.id);

  const { data: historicalVitals } = useGetHistoricalVitals(encounter?.id);

  const abnormalVitalsValues = useMemo(() => getAbnormalVitals(encounterVitals), [encounterVitals]);

  const { interactionMode } = useInPersonNavigationContext();

  const handleSaveVital = async (vitalEntity: VitalsObservationDTO): Promise<void> => {
    await saveVitals(vitalEntity);
    await refetchEncounterVitals();
  };

  const handleDeleteVital = async (vitalEntity: VitalsObservationDTO): Promise<void> => {
    await deleteVitals(vitalEntity);
    await refetchEncounterVitals();
  };

  if (isLoading || encounterVitalsLoading) return <InPersonLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Vitals" showIntakeNotesButton={interactionMode === 'intake'} />
      <VitalsTemperaturesCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        currentObs={encounterVitals?.[VitalFieldNames.VitalTemperature] ?? []}
        historicalObs={historicalVitals?.[VitalFieldNames.VitalTemperature] ?? []}
      />
      <VitalsHeartbeatCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        currentObs={encounterVitals?.[VitalFieldNames.VitalHeartbeat] ?? []}
        historicalObs={historicalVitals?.[VitalFieldNames.VitalHeartbeat] ?? []}
      />
      <VitalsRespirationRateCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        currentObs={encounterVitals?.[VitalFieldNames.VitalRespirationRate] ?? []}
        historicalObs={historicalVitals?.[VitalFieldNames.VitalRespirationRate] ?? []}
      />
      <VitalsBloodPressureCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        currentObs={encounterVitals?.[VitalFieldNames.VitalBloodPressure] ?? []}
        historicalObs={historicalVitals?.[VitalFieldNames.VitalBloodPressure] ?? []}
      />
      <VitalsOxygenSatCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        currentObs={encounterVitals?.[VitalFieldNames.VitalOxygenSaturation] ?? []}
        historicalObs={historicalVitals?.[VitalFieldNames.VitalOxygenSaturation] ?? []}
      />
      <VitalsWeightsCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        currentObs={encounterVitals?.[VitalFieldNames.VitalWeight] ?? []}
        historicalObs={historicalVitals?.[VitalFieldNames.VitalWeight] ?? []}
      />
      <VitalsHeightCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        currentObs={encounterVitals?.[VitalFieldNames.VitalHeight] ?? []}
        historicalObs={historicalVitals?.[VitalFieldNames.VitalHeight] ?? []}
      />
      <VitalsVisionCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        currentObs={encounterVitals?.[VitalFieldNames.VitalVision] ?? []}
        historicalObs={historicalVitals?.[VitalFieldNames.VitalVision] ?? []}
      />
      <VitalsNotesCard />

      <AbnormalVitalsModal abnormalVitalsValues={abnormalVitalsValues} />
    </Stack>
  );
};
