import { Stack, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { PageTitle } from 'src/features/visits/shared/components/PageTitle';
import VitalsNotesCard from 'src/features/visits/shared/components/patient-info/VitalsNotesCard';
import VitalsBloodPressureCard from 'src/features/visits/shared/components/vitals/blood-pressure/VitalsBloodPressureCard';
import VitalsHeartbeatCard from 'src/features/visits/shared/components/vitals/heartbeat/VitalsHeartbeatCard';
import VitalsHeightCard from 'src/features/visits/shared/components/vitals/heights/VitalsHeightCard';
import { useDeleteVitals } from 'src/features/visits/shared/components/vitals/hooks/useDeleteVitals';
import { useGetHistoricalVitals, useGetVitals } from 'src/features/visits/shared/components/vitals/hooks/useGetVitals';
import { useSaveVitals } from 'src/features/visits/shared/components/vitals/hooks/useSaveVitals';
import VitalsOxygenSatCard from 'src/features/visits/shared/components/vitals/oxygen-saturation/VitalsOxygenSatCard';
import VitalsRespirationRateCard from 'src/features/visits/shared/components/vitals/respiration-rate/VitalsRespirationRateCard';
import VitalsTemperaturesCard from 'src/features/visits/shared/components/vitals/temperature/VitalsTemperaturesCard';
import VitalsVisionCard from 'src/features/visits/shared/components/vitals/vision/VitalsVisionCard';
import VitalsWeightsCard from 'src/features/visits/shared/components/vitals/weights/VitalsWeightsCard';
import { getAbnormalVitals, VitalFieldNames, VitalsObservationDTO } from 'utils';
import { Loader } from '../../shared/components/Loader';
import { AbnormalVitalsModal } from '../../shared/components/vitals/AbnormalVitalsModal';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
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

  if (isLoading || encounterVitalsLoading) return <Loader />;
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
