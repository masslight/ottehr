import { Box, Stack, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AssessmentTitle } from 'src/telemed/features/appointment/AssessmentTab';
import { GetVitalsResponseData, VitalFieldNames, VitalsObservationDTO } from 'utils';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { CSSLoader } from '../components/CSSLoader';
import VitalsNotesCard from '../components/patient-info/VitalsNotesCard';
import VitalsBloodPressureCard from '../components/vitals/blood-pressure/VitalsBloodPressureCard';
import VitalHistoryElement from '../components/vitals/components/VitalsHistoryEntry';
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
import { useNavigationContext } from '../context/NavigationContext';
import { useAppointment } from '../hooks/useAppointment';
import { useReactNavigationBlocker } from '../hooks/useReactNavigationBlocker';

interface PatientVitalsProps {
  appointmentID?: string;
}

export const PatientVitals: React.FC<PatientVitalsProps> = () => {
  const { id: appointmentID } = useParams();
  const {
    resources: { appointment, encounter },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const saveVitals = useSaveVitals({
    encounterId: encounter?.id ?? '',
  });

  const deleteVitals = useDeleteVitals({
    encounterId: encounter?.id ?? '',
  });

  const {
    data: encounterVitals,
    isLoading: encounterVitalsLoading,
    refetch: refetchEncounterVitals,
  } = useGetVitals(encounter?.id);

  const { data: historicalVitals } = useGetHistoricalVitals(encounter?.id);

  const abnormalVitalsValues = useMemo(() => {
    const alertingEntries = Object.entries(encounterVitals || {})
      .map(([key, values]) => {
        if (Array.isArray(values)) {
          const newValues = (values as VitalsObservationDTO[]).filter((value) => {
            if (value.alertCriticality) {
              return true;
            } else {
              return false;
            }
          });
          return [key, newValues];
        } else {
          return [key, []];
        }
      })
      .filter(([_, values]) => values.length > 0);

    return Object.fromEntries(alertingEntries);
  }, [encounterVitals]);

  const { interactionMode } = useNavigationContext();

  const handleSaveVital = async (vitalEntity: VitalsObservationDTO): Promise<void> => {
    await saveVitals(vitalEntity);
    await refetchEncounterVitals();
  };

  const handleDeleteVital = async (vitalEntity: VitalsObservationDTO): Promise<void> => {
    await deleteVitals(vitalEntity);
    await refetchEncounterVitals();
  };

  if (isLoading || encounterVitalsLoading) return <CSSLoader />;
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

interface AbnormalVitalsModalProps {
  abnormalVitalsValues: GetVitalsResponseData;
}

const AbnormalVitalsModal: React.FC<AbnormalVitalsModalProps> = ({ abnormalVitalsValues }) => {
  const { ConfirmationModal } = useReactNavigationBlocker(() => {
    return Object.values(abnormalVitalsValues).some((value) => value.length > 0);
  });

  const temperature = abnormalVitalsValues[VitalFieldNames.VitalTemperature];
  const heartbeat = abnormalVitalsValues[VitalFieldNames.VitalHeartbeat];
  const respirationRate = abnormalVitalsValues[VitalFieldNames.VitalRespirationRate];
  const bloodPressure = abnormalVitalsValues[VitalFieldNames.VitalBloodPressure];
  const oxygenSaturation = abnormalVitalsValues[VitalFieldNames.VitalOxygenSaturation];
  const weight = abnormalVitalsValues[VitalFieldNames.VitalWeight];
  const height = abnormalVitalsValues[VitalFieldNames.VitalHeight];

  return (
    <ConfirmationModal
      title="Abnormal Vital Value"
      description="You have entered an abnormal value. Please verify:"
      ContentComponent={() => (
        <Stack spacing={1}>
          {temperature && temperature.length > 0 && (
            <>
              <AssessmentTitle>Temperature</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {temperature?.map((item) => <VitalHistoryElement key={item.resourceId} historyEntry={{ ...item }} />)}
              </Box>
            </>
          )}
          {heartbeat && heartbeat.length > 0 && (
            <>
              <AssessmentTitle>Heartbeat</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {heartbeat?.map((item) => <VitalHistoryElement key={item.resourceId} historyEntry={{ ...item }} />)}
              </Box>
            </>
          )}
          {respirationRate && respirationRate.length > 0 && (
            <>
              <AssessmentTitle>Respiration Rate</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {respirationRate?.map((item) => (
                  <VitalHistoryElement key={item.resourceId} historyEntry={{ ...item }} />
                ))}
              </Box>
            </>
          )}
          {bloodPressure && bloodPressure.length > 0 && (
            <>
              <AssessmentTitle>Blood Pressure</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {bloodPressure?.map((item) => <VitalHistoryElement key={item.resourceId} historyEntry={{ ...item }} />)}
              </Box>
            </>
          )}
          {oxygenSaturation && oxygenSaturation.length > 0 && (
            <>
              <AssessmentTitle>Oxygen Saturation</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {oxygenSaturation?.map((item) => (
                  <VitalHistoryElement key={item.resourceId} historyEntry={{ ...item }} />
                ))}
              </Box>
            </>
          )}
          {weight && weight.length > 0 && (
            <>
              <AssessmentTitle>Weight</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {weight?.map((item) => <VitalHistoryElement key={item.resourceId} historyEntry={{ ...item }} />)}
              </Box>
            </>
          )}
          {height && height.length > 0 && (
            <>
              <AssessmentTitle>Height</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {height?.map((item) => <VitalHistoryElement key={item.resourceId} historyEntry={{ ...item }} />)}
              </Box>
            </>
          )}
        </Stack>
      )}
      confirmText="Back"
      closeButtonText="Continue"
    />
  );
};
