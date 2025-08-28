import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { NoteDTO, VitalFieldNames } from 'utils';
import { AssessmentTitle } from '../../../../telemed/features/appointment/AssessmentTab';
import VitalHistoryElement from '../vitals/components/VitalsHistoryEntry';
import { useGetVitals } from '../vitals/hooks/useGetVitals';

type PatientVitalsContainerProps = {
  notes?: NoteDTO[];
  encounterId: string | undefined;
};

export const PatientVitalsContainer: FC<PatientVitalsContainerProps> = ({ notes, encounterId }) => {
  const { data: encounterVitals } = useGetVitals(encounterId);

  const temperature = encounterVitals?.[VitalFieldNames.VitalTemperature] || [];
  const heartbeat = encounterVitals?.[VitalFieldNames.VitalHeartbeat] || [];
  const respirationRate = encounterVitals?.[VitalFieldNames.VitalRespirationRate] || [];
  const bloodPressure = encounterVitals?.[VitalFieldNames.VitalBloodPressure] || [];
  const oxygenSaturation = encounterVitals?.[VitalFieldNames.VitalOxygenSaturation] || [];
  const weight = encounterVitals?.[VitalFieldNames.VitalWeight] || [];
  const height = encounterVitals?.[VitalFieldNames.VitalHeight] || [];
  const vision = encounterVitals?.[VitalFieldNames.VitalVision] || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Vitals
      </Typography>

      {temperature && temperature.length > 0 && (
        <>
          <AssessmentTitle>Temperature</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {temperature?.map((item) => <VitalHistoryElement historyEntry={item} key={item.resourceId} />)}
          </Box>
        </>
      )}
      {heartbeat && heartbeat.length > 0 && (
        <>
          <AssessmentTitle>Heartbeat</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {heartbeat?.map((item) => <VitalHistoryElement historyEntry={item} key={item.resourceId} />)}
          </Box>
        </>
      )}
      {respirationRate && respirationRate.length > 0 && (
        <>
          <AssessmentTitle>Respiration rate</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {respirationRate?.map((item) => <VitalHistoryElement historyEntry={item} key={item.resourceId} />)}
          </Box>
        </>
      )}
      {bloodPressure && bloodPressure.length > 0 && (
        <>
          <AssessmentTitle>Blood pressure</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {bloodPressure?.map((item) => <VitalHistoryElement historyEntry={item} key={item.resourceId} />)}
          </Box>
        </>
      )}
      {oxygenSaturation && oxygenSaturation.length > 0 && (
        <>
          <AssessmentTitle>Oxygen saturation</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {oxygenSaturation?.map((item) => <VitalHistoryElement historyEntry={item} key={item.resourceId} />)}
          </Box>
        </>
      )}
      {weight && weight.length > 0 && (
        <>
          <AssessmentTitle>Weight</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {weight?.map((item) => <VitalHistoryElement historyEntry={item} key={item.resourceId} />)}
          </Box>
        </>
      )}
      {height && height.length > 0 && (
        <>
          <AssessmentTitle>Height</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {height?.map((item) => <VitalHistoryElement historyEntry={item} key={item.resourceId} />)}
          </Box>
        </>
      )}
      {vision && vision.length > 0 && (
        <>
          <AssessmentTitle>Vision</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {vision?.map((item) => <VitalHistoryElement historyEntry={item} key={item.resourceId} />)}
          </Box>
        </>
      )}

      {notes && notes.length > 0 && (
        <>
          <AssessmentTitle>Vitals notes</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes?.map((note) => <Typography key={note.resourceId}>{note.text}</Typography>)}
          </Box>
        </>
      )}
    </Box>
  );
};
