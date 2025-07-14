import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import { AssessmentTitle } from 'src/telemed/features/appointment/AssessmentTab';
import { allVitalsSearchConfigForEncounter, VitalFieldNames } from 'utils';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { CSSLoader } from '../components/CSSLoader';
import VitalsNotesCard from '../components/patient-info/VitalsNotesCard';
import VitalBloodPressureHistoryElement from '../components/vitals/blood-pressure/VitalBloodPressureHistoryElement';
import { VitalBloodPressureHistoryEntry } from '../components/vitals/blood-pressure/VitalBloodPressureHistoryEntry';
import VitalsBloodPressureCard from '../components/vitals/blood-pressure/VitalsBloodPressureCard';
import VitalHeartbeatHistoryElement from '../components/vitals/heartbeat/VitalHeartbeatHistoryElement';
import { VitalHeartbeatHistoryEntry } from '../components/vitals/heartbeat/VitalHeartbeatHistoryEntry';
import VitalsHeartbeatCard from '../components/vitals/heartbeat/VitalsHeartbeatCard';
import VitalHeightHistoryElement from '../components/vitals/heights/VitalHeightHistoryElement';
import { VitalHeightHistoryEntry } from '../components/vitals/heights/VitalHeightHistoryEntry';
import VitalsHeightCard from '../components/vitals/heights/VitalsHeightCard';
import VitalOxygenSatHistoryElement from '../components/vitals/oxygen-saturation/VitalOxygenSatHistoryElement';
import VitalsOxygenSatCard from '../components/vitals/oxygen-saturation/VitalsOxygenSatCard';
import { VitalsOxygenSatHistoryEntry } from '../components/vitals/oxygen-saturation/VitalsOxygenSatHistoryEntry';
import VitalsRespirationRateCard from '../components/vitals/respiration-rate/VitalsRespirationRateCard';
import VitalsRespirationRateHistoryElementElement from '../components/vitals/respiration-rate/VitalsRespirationRateHistoryElement';
import { VitalsRespirationRateHistoryEntry } from '../components/vitals/respiration-rate/VitalsRespirationRateHistoryEntry';
import VitalsTemperaturesCard from '../components/vitals/temperature/VitalsTemperaturesCard';
import VitalTemperatureHistoryElement from '../components/vitals/temperature/VitalTemperatureHistoryElement';
import { VitalTemperatureHistoryEntry } from '../components/vitals/temperature/VitalTemperatureHistoryEntry';
import VitalsVisionCard from '../components/vitals/vision/VitalsVisionCard';
import VitalsWeightsCard from '../components/vitals/weights/VitalsWeightsCard';
import VitalWeightHistoryElement from '../components/vitals/weights/VitalWeightHistoryElement';
import { VitalWeightHistoryEntry } from '../components/vitals/weights/VitalWeightHistoryEntry';
import { useNavigationContext } from '../context/NavigationContext';
import { useAppointment } from '../hooks/useAppointment';
import { useChartData } from '../hooks/useChartData';
import { useReactNavigationBlocker } from '../hooks/useReactNavigationBlocker';

interface PatientVitalsProps {
  appointmentID?: string;
}

const ABNORMAL_VITALS_VALUES_INITIAL: AbnormalVitalsValuesMap = {
  [VitalFieldNames.VitalTemperature]: [],
  [VitalFieldNames.VitalHeartbeat]: [],
  [VitalFieldNames.VitalRespirationRate]: [],
  [VitalFieldNames.VitalBloodPressure]: [],
  [VitalFieldNames.VitalOxygenSaturation]: [],
  [VitalFieldNames.VitalHeight]: [],
  [VitalFieldNames.VitalWeight]: [],
};

export const PatientVitals: React.FC<PatientVitalsProps> = () => {
  const { id: appointmentID } = useParams();
  const {
    resources: { appointment, encounter },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const searchConfig = allVitalsSearchConfigForEncounter();

  const { chartData, isLoading: isChartDataLoading } = useChartData({
    encounterId: encounter?.id ?? '',
    requestedFields: { [searchConfig.fieldName]: searchConfig.searchParams },
  });

  console.log('chart data', encounter?.id, searchConfig.fieldName, searchConfig.searchParams, chartData);

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
      <AbnormalVitalsModal abnormalVitalsValues={ABNORMAL_VITALS_VALUES_INITIAL} />
    </Stack>
  );
};

const emptyDelete = async (): Promise<void> => {
  return;
};

type AbnormalVitalsValuesMap = {
  [VitalFieldNames.VitalTemperature]: VitalTemperatureHistoryEntry[];
  [VitalFieldNames.VitalHeartbeat]: VitalHeartbeatHistoryEntry[];
  [VitalFieldNames.VitalRespirationRate]: VitalsRespirationRateHistoryEntry[];
  [VitalFieldNames.VitalBloodPressure]: VitalBloodPressureHistoryEntry[];
  [VitalFieldNames.VitalOxygenSaturation]: VitalsOxygenSatHistoryEntry[];
  [VitalFieldNames.VitalHeight]: VitalHeightHistoryEntry[];
  [VitalFieldNames.VitalWeight]: VitalWeightHistoryEntry[];
};

interface AbnormalVitalsModalProps {
  abnormalVitalsValues: AbnormalVitalsValuesMap;
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
                {temperature?.map((item) => (
                  <VitalTemperatureHistoryElement
                    key={item.fhirResourceId}
                    historyEntry={{ ...item, isDeletable: false }}
                    onDelete={emptyDelete}
                  />
                ))}
              </Box>
            </>
          )}
          {heartbeat && heartbeat.length > 0 && (
            <>
              <AssessmentTitle>Heartbeat</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {heartbeat?.map((item) => (
                  <VitalHeartbeatHistoryElement
                    key={item.fhirResourceId}
                    historyEntry={{ ...item, isDeletable: false }}
                    onDelete={emptyDelete}
                  />
                ))}
              </Box>
            </>
          )}
          {respirationRate && respirationRate.length > 0 && (
            <>
              <AssessmentTitle>Respiration Rate</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {respirationRate?.map((item) => (
                  <VitalsRespirationRateHistoryElementElement
                    key={item.fhirResourceId}
                    historyEntry={{ ...item, isDeletable: false }}
                    onDelete={emptyDelete}
                  />
                ))}
              </Box>
            </>
          )}
          {bloodPressure && bloodPressure.length > 0 && (
            <>
              <AssessmentTitle>Blood Pressure</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {bloodPressure?.map((item) => (
                  <VitalBloodPressureHistoryElement
                    key={item.fhirResourceId}
                    historyEntry={{ ...item, isDeletable: false }}
                    onDelete={emptyDelete}
                  />
                ))}
              </Box>
            </>
          )}
          {oxygenSaturation && oxygenSaturation.length > 0 && (
            <>
              <AssessmentTitle>Oxygen Saturation</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {oxygenSaturation?.map((item) => (
                  <VitalOxygenSatHistoryElement
                    key={item.fhirResourceId}
                    historyEntry={{ ...item, isDeletable: false }}
                    onDelete={emptyDelete}
                  />
                ))}
              </Box>
            </>
          )}
          {weight && weight.length > 0 && (
            <>
              <AssessmentTitle>Weight</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {weight?.map((item) => (
                  <VitalWeightHistoryElement
                    key={item.fhirResourceId}
                    historyEntry={{ ...item, isDeletable: false }}
                    onDelete={emptyDelete}
                  />
                ))}
              </Box>
            </>
          )}
          {height && height.length > 0 && (
            <>
              <AssessmentTitle>Height</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {height?.map((item) => (
                  <VitalHeightHistoryElement
                    key={item.fhirResourceId}
                    historyEntry={{ ...item, isDeletable: false }}
                    onDelete={emptyDelete}
                  />
                ))}
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
