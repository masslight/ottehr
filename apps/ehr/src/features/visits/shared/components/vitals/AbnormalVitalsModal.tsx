import { Box, Stack } from '@mui/system';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { GetVitalsResponseData, VitalFieldNames } from 'utils';
import { useReactNavigationBlocker } from '../../hooks/useReactNavigationBlocker';
import VitalHistoryElement from './components/VitalsHistoryEntry';

interface AbnormalVitalsModalProps {
  abnormalVitalsValues: GetVitalsResponseData;
}

export const AbnormalVitalsModal: React.FC<AbnormalVitalsModalProps> = ({ abnormalVitalsValues }) => {
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
      ContentComponent={
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
      }
      confirmText="Back"
      closeButtonText="Continue"
    />
  );
};
