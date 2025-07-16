import { Box, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AssessmentTitle } from 'src/telemed/features/appointment/AssessmentTab';
import {
  AlertRule,
  allVitalsSearchConfigForEncounter,
  VitalFieldNames,
  VitalsDef,
  VitalsKey,
  VitalsNumericValueObservationDTO,
} from 'utils';
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

  console.log('VitalsDef', VitalsDef);

  const abnormalVitalsValues = useMemo(() => {
    const abnormalValues: AbnormalVitalsValuesMap = {
      [VitalFieldNames.VitalTemperature]: [],
      [VitalFieldNames.VitalHeartbeat]: [],
      [VitalFieldNames.VitalRespirationRate]: [],
      [VitalFieldNames.VitalBloodPressure]: [],
      [VitalFieldNames.VitalOxygenSaturation]: [],
      [VitalFieldNames.VitalHeight]: [],
      [VitalFieldNames.VitalWeight]: [],
    };

    /*
    if (!patient?.birthDate || !chartData) return abnormalValues;

    const dob = patient.birthDate;

    const patientAgeInMonths = DateTime.fromISO(dob).diffNow('months').months * -1;
    Object.entries(vitalsKeyToFieldNameMap).forEach(([vitalsKey, fieldName]) => {
      const rules = findRulesForVitalsKeyAndDOB(vitalsKey as VitalsKey, dob);
      console.log('rules for', vitalsKey, rules.length);
      const values = chartData.vitalsObservations?.filter((obs) => {
        return (
          obs.encounterId === encounter?.id &&
          obs.field === fieldName &&
          obs.value !== undefined &&
          obs.value !== null &&
          typeof obs.value === 'number'
        );
      }) as VitalsNumericValueObservationDTO[];
      console.log('values for', vitalsKey, values);
      const alertableValues = findAlertableValues({ vitalsValues: values, rules, patientAgeInMonths });
      if (alertableValues.length > 0) {
        console.log('alertable values for', vitalsKey, alertableValues);
        abnormalValues[fieldName].push(...alertableValues);
      }
    });*/
    return abnormalValues;
  }, []);

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
      <AbnormalVitalsModal abnormalVitalsValues={abnormalVitalsValues} />
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const vitalsKeyToFieldNameMap: Record<VitalsKey, keyof AbnormalVitalsValuesMap> = {
  temperature: VitalFieldNames.VitalTemperature,
  heartRate: VitalFieldNames.VitalHeartbeat,
  respiratoryRate: VitalFieldNames.VitalRespirationRate,
  sp02: VitalFieldNames.VitalOxygenSaturation,
  systolicBloodPressure: VitalFieldNames.VitalBloodPressure,
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const findRulesForVitalsKeyAndDOB = (key: VitalsKey, dob: string): AlertRule[] => {
  const dateOfBirth = DateTime.fromISO(dob);
  const now = DateTime.now();
  const alertThresholds = VitalsDef[key]?.alertThresholds ?? [];
  const rules = alertThresholds
    .filter((threshold) => {
      const { minAge, maxAge } = threshold;
      if (!minAge && !maxAge) return true;
      if (minAge) {
        const minAgeDOB = now.minus({ [minAge.unit]: minAge.value });
        if (dateOfBirth > minAgeDOB) return false;
      }
      if (maxAge) {
        const maxAgeDOB = now.minus({ [maxAge.unit]: maxAge.value });
        if (dateOfBirth < maxAgeDOB) return false;
      }
      return true;
    })
    .flatMap((threshold) => threshold.rules ?? []);
  return rules;
};

interface AlertableValuesInput {
  vitalsValues: VitalsNumericValueObservationDTO[];
  rules: AlertRule[];
  patientAgeInMonths: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const findAlertableValues = (input: AlertableValuesInput): VitalsNumericValueObservationDTO[] => {
  const { vitalsValues, rules, patientAgeInMonths } = input;
  return vitalsValues.filter((vitalVal) => {
    const value = vitalVal.value;
    if (value === undefined || value === null || typeof value !== 'number') {
      console.warn('Vital value is not a number:', vitalVal);
      return false;
    }
    return rules.some((rule) => {
      const { type } = rule;
      let thresholdValue: number | undefined;

      if ((rule as any).value !== undefined) {
        thresholdValue = (rule as any).value;
      } else if ((rule as any).ageFunction) {
        thresholdValue = (rule as any).ageFunction(patientAgeInMonths);
      }
      if (thresholdValue === undefined) {
        console.warn('Rule does not have a value or ageFunction:', rule);
        return false;
      }

      if (type === 'min' && value < thresholdValue) return true;
      if (type === 'max' && value > thresholdValue) return true;
      return false;
    });
  });
};
