import { Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { CSSLoader } from 'src/features/css-module/components/CSSLoader';
import VitalsNotesCard from 'src/features/css-module/components/patient-info/VitalsNotesCard';
import VitalsBloodPressureCard from 'src/features/css-module/components/vitals/blood-pressure/VitalsBloodPressureCard';
import VitalsHeartbeatCard from 'src/features/css-module/components/vitals/heartbeat/VitalsHeartbeatCard';
import VitalsHeightCard from 'src/features/css-module/components/vitals/heights/VitalsHeightCard';
import { useDeleteVitals } from 'src/features/css-module/components/vitals/hooks/useDeleteVitals';
import { useGetHistoricalVitals, useGetVitals } from 'src/features/css-module/components/vitals/hooks/useGetVitals';
import { useSaveVitals } from 'src/features/css-module/components/vitals/hooks/useSaveVitals';
import VitalsOxygenSatCard from 'src/features/css-module/components/vitals/oxygen-saturation/VitalsOxygenSatCard';
import VitalsRespirationRateCard from 'src/features/css-module/components/vitals/respiration-rate/VitalsRespirationRateCard';
import VitalsTemperaturesCard from 'src/features/css-module/components/vitals/temperature/VitalsTemperaturesCard';
import VitalsVisionCard from 'src/features/css-module/components/vitals/vision/VitalsVisionCard';
import VitalsWeightsCard from 'src/features/css-module/components/vitals/weights/VitalsWeightsCard';
import { useNavigationContext } from 'src/features/css-module/context/NavigationContext';
import { useAppointmentData, useChartData } from 'src/telemed';
import { PageTitle } from 'src/telemed/components/PageTitle';
import { VitalFieldNames, VitalsObservationDTO } from 'utils';

export const VitalsTab: FC = () => {
  const { appointment, encounter, isAppointmentLoading, appointmentError } = useAppointmentData();
  const { isChartDataLoading, chartDataError } = useChartData();
  const error = appointmentError || chartDataError;
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const { interactionMode } = useNavigationContext();

  // todo: this duplicates the functionality of PatientVitals page and could be refactored to use a shared component
  const saveVitals = useSaveVitals({
    encounterId: encounter?.id ?? '',
  });

  const deleteVitals = useDeleteVitals({
    encounterId: encounter?.id ?? '',
  });

  const handleSaveVital = async (vitalEntity: VitalsObservationDTO): Promise<void> => {
    await saveVitals(vitalEntity);
    await refetchEncounterVitals();
  };

  const handleDeleteVital = async (vitalEntity: VitalsObservationDTO): Promise<void> => {
    await deleteVitals(vitalEntity);
    await refetchEncounterVitals();
  };

  const {
    data: encounterVitals,
    isLoading: encounterVitalsLoading,
    refetch: refetchEncounterVitals,
  } = useGetVitals(encounter?.id);

  const { data: historicalVitals } = useGetHistoricalVitals(encounter?.id);

  if (isLoading || isChartDataLoading || encounterVitalsLoading) return <CSSLoader />;
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
      {/* Alert modal needed here??*/}
    </Stack>
  );
};
