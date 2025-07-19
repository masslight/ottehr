import { Box, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useMemo } from 'react';
import { useQuery } from 'react-query';
import { useParams } from 'react-router-dom';
import { useApiClients } from 'src/hooks/useAppClients';
import { AssessmentTitle } from 'src/telemed/features/appointment/AssessmentTab';
import {
  AlertRule,
  GetVitalsResponseData,
  VitalFieldNames,
  VitalsBloodPressureObservationDTO,
  VitalsDef,
  VitalsHeartbeatObservationDTO,
  VitalsHeightObservationDTO,
  VitalsKey,
  VitalsObservationDTO,
  VitalsOxygenSatObservationDTO,
  VitalsRespirationRateObservationDTO,
  VitalsTemperatureObservationDTO,
  VitalsWeightObservationDTO,
} from 'utils';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { CSSLoader } from '../components/CSSLoader';
import VitalsNotesCard from '../components/patient-info/VitalsNotesCard';
import VitalBloodPressureHistoryElement from '../components/vitals/blood-pressure/VitalBloodPressureHistoryElement';
import VitalsBloodPressureCard from '../components/vitals/blood-pressure/VitalsBloodPressureCard';
import VitalHeartbeatHistoryElement from '../components/vitals/heartbeat/VitalHeartbeatHistoryElement';
import VitalsHeartbeatCard from '../components/vitals/heartbeat/VitalsHeartbeatCard';
import VitalHeightHistoryElement from '../components/vitals/heights/VitalHeightHistoryElement';
import VitalsHeightCard from '../components/vitals/heights/VitalsHeightCard';
import { useSaveVitals } from '../components/vitals/hooks/useSaveVitals';
import VitalOxygenSatHistoryElement from '../components/vitals/oxygen-saturation/VitalOxygenSatHistoryElement';
import VitalsOxygenSatCard from '../components/vitals/oxygen-saturation/VitalsOxygenSatCard';
import VitalsRespirationRateCard from '../components/vitals/respiration-rate/VitalsRespirationRateCard';
import VitalsRespirationRateHistoryElementElement from '../components/vitals/respiration-rate/VitalsRespirationRateHistoryElement';
import VitalsTemperaturesCard from '../components/vitals/temperature/VitalsTemperaturesCard';
import VitalTemperatureHistoryElement from '../components/vitals/temperature/VitalTemperatureHistoryElement';
import VitalsVisionCard from '../components/vitals/vision/VitalsVisionCard';
import VitalsWeightsCard from '../components/vitals/weights/VitalsWeightsCard';
import VitalWeightHistoryElement from '../components/vitals/weights/VitalWeightHistoryElement';
import { useNavigationContext } from '../context/NavigationContext';
import { useAppointment } from '../hooks/useAppointment';
import { useReactNavigationBlocker } from '../hooks/useReactNavigationBlocker';

interface PatientVitalsProps {
  appointmentID?: string;
}

export const PatientVitals: React.FC<PatientVitalsProps> = () => {
  const { id: appointmentID } = useParams();
  const {
    resources: { appointment, encounter, patient },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const { oystehrZambda } = useApiClients();

  const saveVitals = useSaveVitals({
    encounterId: encounter?.id ?? '',
  });

  const {
    data: encounterVitals,
    isLoading: encounterVitalsLoading,
    refetch: refetchEncounterVitals,
  } = useQuery(
    [`current-encounter-vitals-${encounter?.id}`],
    async () => {
      if (oystehrZambda && encounter?.id) {
        const result = await oystehrZambda.zambda.execute({
          id: 'get-vitals',
          encounterId: encounter.id,
        });
        // todo: make this strictly typed once there is a common api file defining endpoints available
        return result.output as GetVitalsResponseData;
      }

      throw new Error('api client not defined or encounter id is not provided');
    },
    {
      enabled: Boolean(encounter?.id) && Boolean(oystehrZambda),
    }
  );

  const { interactionMode } = useNavigationContext();

  console.log('VitalsDef', VitalsDef);

  const abnormalVitalsValues = useMemo(() => {
    const abnormalValues: VitalsMap = {
      [VitalFieldNames.VitalTemperature]: [],
      [VitalFieldNames.VitalHeartbeat]: [],
      [VitalFieldNames.VitalRespirationRate]: [],
      [VitalFieldNames.VitalBloodPressure]: [],
      [VitalFieldNames.VitalOxygenSaturation]: [],
      [VitalFieldNames.VitalHeight]: [],
      [VitalFieldNames.VitalWeight]: [],
    };

    if (!patient?.birthDate || !encounterVitalsLoading) return abnormalValues;

    const dob = patient.birthDate;

    const patientAgeInMonths = DateTime.fromISO(dob).diffNow('months').months * -1;
    Object.entries(vitalsKeyToFieldNameMap).forEach(([vitalsKey, fieldName]) => {
      const rules = findRulesForVitalsKeyAndDOB(vitalsKey as VitalsKey, dob);
      console.log('rules for', vitalsKey, rules.length);
      const values = Object.values(encounterVitals || {}).flatMap((v) => v) as VitalsObservationDTO[];
      console.log('values for', vitalsKey, values);
      const alertableValues = findAlertableValues({ vitalsValues: values, rules, patientAgeInMonths });
      if (alertableValues.length > 0) {
        console.log('alertable values for', vitalsKey, alertableValues);
        (abnormalValues[fieldName] as VitalsObservationDTO[]).push(...alertableValues);
      }
    });
    return abnormalValues;
  }, [patient?.birthDate, encounterVitalsLoading, encounterVitals]);

  const handleSaveVital = async (vitalEntity: VitalsObservationDTO): Promise<void> => {
    console.log('handleSaveVital called with:', vitalEntity);
    // Implement the save logic here
    await saveVitals(vitalEntity);
    await refetchEncounterVitals(); // Refetch to get the latest vitals after saving
  };

  const handleDeleteVital = async (vitalEntity: VitalsObservationDTO): Promise<void> => {
    console.log('handleDeleteVital called with:', vitalEntity);
    // Implement the delete logic here
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
        isLoading={false}
        currentObs={encounterVitals?.[VitalFieldNames.VitalTemperature] ?? []}
        historicalObs={[]}
      />
      <VitalsHeartbeatCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        isLoading={false}
        currentObs={encounterVitals?.[VitalFieldNames.VitalHeartbeat] ?? []}
        historicalObs={[]}
      />
      <VitalsRespirationRateCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        isLoading={false}
        currentObs={encounterVitals?.[VitalFieldNames.VitalRespirationRate] ?? []}
        historicalObs={[]}
      />
      <VitalsBloodPressureCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        isLoading={false}
        currentObs={encounterVitals?.[VitalFieldNames.VitalBloodPressure] ?? []}
        historicalObs={[]}
      />
      <VitalsOxygenSatCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        isLoading={false}
        currentObs={encounterVitals?.[VitalFieldNames.VitalOxygenSaturation] ?? []}
        historicalObs={[]}
      />
      <VitalsWeightsCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        isLoading={false}
        currentObs={encounterVitals?.[VitalFieldNames.VitalWeight] ?? []}
        historicalObs={[]}
      />
      <VitalsHeightCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        isLoading={false}
        currentObs={encounterVitals?.[VitalFieldNames.VitalHeight] ?? []}
        historicalObs={[]}
      />
      <VitalsVisionCard
        handleSaveVital={handleSaveVital}
        handleDeleteVital={handleDeleteVital}
        isLoading={false}
        currentObs={encounterVitals?.[VitalFieldNames.VitalVision] ?? []}
        historicalObs={[]}
      />
      <VitalsNotesCard />
      <AbnormalVitalsModal abnormalVitalsValues={abnormalVitalsValues} />
    </Stack>
  );
};

const emptyDelete = async (): Promise<void> => {
  return;
};

type VitalsMap = {
  [VitalFieldNames.VitalTemperature]: VitalsTemperatureObservationDTO[];
  [VitalFieldNames.VitalHeartbeat]: VitalsHeartbeatObservationDTO[];
  [VitalFieldNames.VitalRespirationRate]: VitalsRespirationRateObservationDTO[];
  [VitalFieldNames.VitalBloodPressure]: VitalsBloodPressureObservationDTO[];
  [VitalFieldNames.VitalOxygenSaturation]: VitalsOxygenSatObservationDTO[];
  [VitalFieldNames.VitalHeight]: VitalsHeightObservationDTO[];
  [VitalFieldNames.VitalWeight]: VitalsWeightObservationDTO[];
};

const vitalsKeyToFieldNameMap: Record<VitalsKey, keyof VitalsMap> = {
  temperature: VitalFieldNames.VitalTemperature,
  heartRate: VitalFieldNames.VitalHeartbeat,
  respiratoryRate: VitalFieldNames.VitalRespirationRate,
  sp02: VitalFieldNames.VitalOxygenSaturation,
  systolicBloodPressure: VitalFieldNames.VitalBloodPressure,
};

interface AbnormalVitalsModalProps {
  abnormalVitalsValues: VitalsMap;
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
                    key={item.resourceId}
                    historyEntry={{ ...item }}
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
                    key={item.resourceId}
                    historyEntry={{ ...item }}
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
                    key={item.resourceId}
                    historyEntry={{ ...item }}
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
                    key={item.resourceId}
                    historyEntry={{ ...item }}
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
                    key={item.resourceId}
                    historyEntry={{ ...item }}
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
                  <VitalWeightHistoryElement key={item.resourceId} historyEntry={{ ...item }} onDelete={emptyDelete} />
                ))}
              </Box>
            </>
          )}
          {height && height.length > 0 && (
            <>
              <AssessmentTitle>Height</AssessmentTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {height?.map((item) => (
                  <VitalHeightHistoryElement key={item.resourceId} historyEntry={{ ...item }} onDelete={emptyDelete} />
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
  vitalsValues: VitalsObservationDTO[];
  rules: AlertRule[];
  patientAgeInMonths: number;
}

const findAlertableValues = (input: AlertableValuesInput): VitalsObservationDTO[] => {
  const { vitalsValues, rules, patientAgeInMonths } = input;
  return vitalsValues.filter((vitalVal) => {
    const value = vitalVal.value;
    if (value === undefined || value === null || typeof value !== 'number') {
      console.warn('Vital value is not a number:', vitalVal);
      // todo: handle the non-numeric value cases
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
