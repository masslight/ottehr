import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { NoteDTO, VitalFieldNames } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../telemed';
import { AssessmentTitle } from '../../../../telemed/features/appointment/AssessmentTab';
import { composeBloodPressureVitalsHistoryEntries } from '../vitals/blood-pressure/helpers';
import VitalBloodPressureHistoryElement from '../vitals/blood-pressure/VitalBloodPressureHistoryElement';
import { composeHeartbeatHistoryEntries } from '../vitals/heartbeat/helpers';
import VitalHeartbeatHistoryElement from '../vitals/heartbeat/VitalHeartbeatHistoryElement';
import { composeHeightVitalsHistoryEntries } from '../vitals/heights/helpers';
import VitalHeightHistoryElement from '../vitals/heights/VitalHeightHistoryElement';
import { composeOxygenSatHistoryEntries } from '../vitals/oxygen-saturation/helpers';
import VitalOxygenSatHistoryElement from '../vitals/oxygen-saturation/VitalOxygenSatHistoryElement';
import { composeRespirationRateHistoryEntries } from '../vitals/respiration-rate/helpers';
import VitalsRespirationRateHistoryElementElement from '../vitals/respiration-rate/VitalsRespirationRateHistoryElement';
import { composeTemperatureVitalsHistoryEntries } from '../vitals/temperature/helpers';
import VitalTemperatureHistoryElement from '../vitals/temperature/VitalTemperatureHistoryElement';
import { composeVisionVitalsHistoryEntries } from '../vitals/vision/helpers';
import VitalVisionHistoryElement from '../vitals/vision/VitalVisionHistoryElement';
import { composeWeightVitalsHistoryEntries } from '../vitals/weights/helpers';
import VitalWeightHistoryElement from '../vitals/weights/VitalWeightHistoryElement';

const emptyDelete = async (): Promise<void> => {
  return;
};

type PatientVitalsContainerProps = {
  notes?: NoteDTO[];
};

export const PatientVitalsContainer: FC<PatientVitalsContainerProps> = ({ notes }) => {
  const { chartData, encounter } = getSelectors(useAppointmentStore, ['chartData', 'encounter']);

  const temperature = composeTemperatureVitalsHistoryEntries(
    encounter.id || '',
    undefined,
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalTemperature) || [],
    []
  );
  const heartbeat = composeHeartbeatHistoryEntries(
    encounter.id || '',
    undefined,
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalHeartbeat) || [],
    []
  );
  const respirationRate = composeRespirationRateHistoryEntries(
    encounter.id || '',
    undefined,
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalRespirationRate) || [],
    []
  );
  const bloodPressure = composeBloodPressureVitalsHistoryEntries(
    encounter.id || '',
    undefined,
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalBloodPressure) || [],
    []
  );
  const oxygenSaturation = composeOxygenSatHistoryEntries(
    encounter.id || '',
    undefined,
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalOxygenSaturation) || [],
    []
  );
  const weight = composeWeightVitalsHistoryEntries(
    encounter.id || '',
    undefined,
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalWeight) || [],
    []
  );
  const height = composeHeightVitalsHistoryEntries(
    encounter.id || '',
    undefined,
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalHeight) || [],
    []
  );
  const vision = composeVisionVitalsHistoryEntries(
    encounter.id || '',
    undefined,
    chartData?.vitalsObservations?.filter((vital) => vital.field === VitalFieldNames.VitalVision) || [],
    []
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Vitals
      </Typography>

      {temperature && temperature.length > 0 && (
        <>
          <AssessmentTitle>Temperature</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {temperature?.map((item) => <VitalTemperatureHistoryElement historyEntry={item} onDelete={emptyDelete} />)}
          </Box>
        </>
      )}
      {heartbeat && heartbeat.length > 0 && (
        <>
          <AssessmentTitle>Heartbeat</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {heartbeat?.map((item) => <VitalHeartbeatHistoryElement historyEntry={item} onDelete={emptyDelete} />)}
          </Box>
        </>
      )}
      {respirationRate && respirationRate.length > 0 && (
        <>
          <AssessmentTitle>Respiration rate</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {respirationRate?.map((item) => (
              <VitalsRespirationRateHistoryElementElement historyEntry={item} onDelete={emptyDelete} />
            ))}
          </Box>
        </>
      )}
      {bloodPressure && bloodPressure.length > 0 && (
        <>
          <AssessmentTitle>Blood pressure</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {bloodPressure?.map((item) => (
              <VitalBloodPressureHistoryElement historyEntry={item} onDelete={emptyDelete} />
            ))}
          </Box>
        </>
      )}
      {oxygenSaturation && oxygenSaturation.length > 0 && (
        <>
          <AssessmentTitle>Oxygen saturation</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {oxygenSaturation?.map((item) => (
              <VitalOxygenSatHistoryElement historyEntry={item} onDelete={emptyDelete} />
            ))}
          </Box>
        </>
      )}
      {weight && weight.length > 0 && (
        <>
          <AssessmentTitle>Weight</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {weight?.map((item) => <VitalWeightHistoryElement historyEntry={item} onDelete={emptyDelete} />)}
          </Box>
        </>
      )}
      {height && height.length > 0 && (
        <>
          <AssessmentTitle>Height</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {height?.map((item) => <VitalHeightHistoryElement historyEntry={item} onDelete={emptyDelete} />)}
          </Box>
        </>
      )}
      {vision && vision.length > 0 && (
        <>
          <AssessmentTitle>Vision</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {vision?.map((item) => <VitalVisionHistoryElement historyEntry={item} onDelete={emptyDelete} />)}
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
