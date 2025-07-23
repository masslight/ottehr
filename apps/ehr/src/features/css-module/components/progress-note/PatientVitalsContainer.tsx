import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { NoteDTO, VitalFieldNames } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../telemed';
import { AssessmentTitle } from '../../../../telemed/features/appointment/AssessmentTab';
import VitalHistoryElement from '../vitals/components/VitalsHistoryEntry';

type PatientVitalsContainerProps = {
  notes?: NoteDTO[];
};

export const PatientVitalsContainer: FC<PatientVitalsContainerProps> = ({ notes }) => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData', 'encounter']);

  const temperature =
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalTemperature) || [];
  const heartbeat =
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalHeartbeat) || [];
  const respirationRate =
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalRespirationRate) || [];
  const bloodPressure =
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalBloodPressure) || [];
  const oxygenSaturation =
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalOxygenSaturation) || [];
  const weight = chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalWeight) || [];
  const height = chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalHeight) || [];
  const vision = chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalVision) || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Vitals
      </Typography>

      {temperature && temperature.length > 0 && (
        <>
          <AssessmentTitle>Temperature</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {temperature?.map((item) => <VitalHistoryElement historyEntry={item} />)}
          </Box>
        </>
      )}
      {heartbeat && heartbeat.length > 0 && (
        <>
          <AssessmentTitle>Heartbeat</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {heartbeat?.map((item) => <VitalHistoryElement historyEntry={item} />)}
          </Box>
        </>
      )}
      {respirationRate && respirationRate.length > 0 && (
        <>
          <AssessmentTitle>Respiration rate</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {respirationRate?.map((item) => <VitalHistoryElement historyEntry={item} />)}
          </Box>
        </>
      )}
      {bloodPressure && bloodPressure.length > 0 && (
        <>
          <AssessmentTitle>Blood pressure</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {bloodPressure?.map((item) => <VitalHistoryElement historyEntry={item} />)}
          </Box>
        </>
      )}
      {oxygenSaturation && oxygenSaturation.length > 0 && (
        <>
          <AssessmentTitle>Oxygen saturation</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {oxygenSaturation?.map((item) => <VitalHistoryElement historyEntry={item} />)}
          </Box>
        </>
      )}
      {weight && weight.length > 0 && (
        <>
          <AssessmentTitle>Weight</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {weight?.map((item) => <VitalHistoryElement historyEntry={item} />)}
          </Box>
        </>
      )}
      {height && height.length > 0 && (
        <>
          <AssessmentTitle>Height</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {height?.map((item) => <VitalHistoryElement historyEntry={item} />)}
          </Box>
        </>
      )}
      {vision && vision.length > 0 && (
        <>
          <AssessmentTitle>Vision</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {vision?.map((item) => <VitalHistoryElement historyEntry={item} />)}
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
