import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { VitalFieldNames, VitalsObservationDTO } from 'utils';
import { useGetAbnormalVitals } from '../hooks/useGetVitals';
import VitalHistoryElement from './VitalsHistoryEntry';

export const AbnormalVitalsContent: React.FC = () => {
  const values = useGetAbnormalVitals();

  const temperature = values?.[VitalFieldNames.VitalTemperature] ?? [];
  const heartbeat = values?.[VitalFieldNames.VitalHeartbeat] ?? [];
  const respirationRate = values?.[VitalFieldNames.VitalRespirationRate] ?? [];
  const bloodPressure = values?.[VitalFieldNames.VitalBloodPressure] ?? [];
  const oxygenSaturation = values?.[VitalFieldNames.VitalOxygenSaturation] ?? [];
  const weight = values?.[VitalFieldNames.VitalWeight] ?? [];
  const height = values?.[VitalFieldNames.VitalHeight] ?? [];

  const any =
    temperature.length +
      heartbeat.length +
      respirationRate.length +
      bloodPressure.length +
      oxygenSaturation.length +
      weight.length +
      height.length >
    0;

  if (!any) return <Typography variant="body2">No abnormal values found.</Typography>;

  return (
    <Stack spacing={1}>
      {temperature.length > 0 && (
        <>
          <AssessmentTitle>Temperature</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {temperature.map((i: VitalsObservationDTO) => (
              <VitalHistoryElement key={i.resourceId} historyEntry={{ ...i }} />
            ))}
          </Box>
        </>
      )}

      {heartbeat.length > 0 && (
        <>
          <AssessmentTitle>Heartbeat</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {heartbeat.map((i: VitalsObservationDTO) => (
              <VitalHistoryElement key={i.resourceId} historyEntry={{ ...i }} />
            ))}
          </Box>
        </>
      )}

      {respirationRate.length > 0 && (
        <>
          <AssessmentTitle>Respiration Rate</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {respirationRate.map((i: VitalsObservationDTO) => (
              <VitalHistoryElement key={i.resourceId} historyEntry={{ ...i }} />
            ))}
          </Box>
        </>
      )}

      {bloodPressure.length > 0 && (
        <>
          <AssessmentTitle>Blood Pressure</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {bloodPressure.map((i: VitalsObservationDTO) => (
              <VitalHistoryElement key={i.resourceId} historyEntry={{ ...i }} />
            ))}
          </Box>
        </>
      )}

      {oxygenSaturation.length > 0 && (
        <>
          <AssessmentTitle>Oxygen Saturation</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {oxygenSaturation.map((i: VitalsObservationDTO) => (
              <VitalHistoryElement key={i.resourceId} historyEntry={{ ...i }} />
            ))}
          </Box>
        </>
      )}

      {weight.length > 0 && (
        <>
          <AssessmentTitle>Weight</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {weight.map((i: VitalsObservationDTO) => (
              <VitalHistoryElement key={i.resourceId} historyEntry={{ ...i }} />
            ))}
          </Box>
        </>
      )}

      {height.length > 0 && (
        <>
          <AssessmentTitle>Height</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {height.map((i: VitalsObservationDTO) => (
              <VitalHistoryElement key={i.resourceId} historyEntry={{ ...i }} />
            ))}
          </Box>
        </>
      )}
    </Stack>
  );
};
