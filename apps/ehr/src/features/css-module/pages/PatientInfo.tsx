import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useAppointmentData, useChartData } from 'src/telemed';
import { VitalFieldNames, VitalsObservationDTO } from 'utils';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { CSSLoader } from '../components/CSSLoader';
import GeneralInfoCard from '../components/patient-info/GeneralInfoCard';
import VitalsNotesCard from '../components/patient-info/VitalsNotesCard';
import { useDeleteVitals } from '../components/vitals/hooks/useDeleteVitals';
import { useGetVitals } from '../components/vitals/hooks/useGetVitals';
import { useSaveVitals } from '../components/vitals/hooks/useSaveVitals';
import VitalsWeightsCard from '../components/vitals/weights/VitalsWeightsCard';
interface PatientInfoProps {
  appointmentID?: string;
}

export const PatientInfo: React.FC<PatientInfoProps> = () => {
  const {
    resources: { appointment, encounter },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  // todo: create a component so that this logic can be shared across this and PatientVitals page and anywhere else that needs this same functionality
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

  if (isLoading || isChartDataLoading || encounterVitalsLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="General Info" />
      <GeneralInfoCard />
      <VitalsWeightsCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        currentObs={encounterVitals?.[VitalFieldNames.VitalWeight] ?? []}
        historicalObs={[]}
      />
      <VitalsNotesCard />
    </Stack>
  );
};
