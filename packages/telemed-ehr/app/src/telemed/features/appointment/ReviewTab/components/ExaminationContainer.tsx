import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getQuestionnaireResponseByLinkId } from 'ehr-utils';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore, useExamObservationsStore } from '../../../../state';
import {
  convertTemperature,
  parseRashesFieldToName,
  rashesFields,
  examObservationFieldsDetailsArray,
  parseMusculoskeletalFieldToName,
} from '../../../../utils';
import { AssessmentTitle } from '../../AssessmentTab';
import { useExamObservations } from '../../../../hooks/useExamObservations';
import { ExamReviewGroup } from './ExamReviewGroup';
import { ExamReviewComment } from './ExamReviewComment';

type ExaminationContainerProps = {
  noTitle?: boolean;
};

export const ExaminationContainer: FC<ExaminationContainerProps> = (props) => {
  const { noTitle } = props;

  const { questionnaireResponse } = getSelectors(useAppointmentStore, ['questionnaireResponse']);
  const examObservations = useExamObservationsStore();
  const { value: rashesValues } = useExamObservations(rashesFields);

  const rashesLabels = examObservationFieldsDetailsArray
    .filter((details) => details.card === 'skin' && details.group === 'form')
    .filter((details) => examObservations[details.field].value)
    .map((details) => parseRashesFieldToName(details.field, rashesValues));

  const abnormalMusculoskeletalLabels = examObservationFieldsDetailsArray
    .filter((details) => details.card === 'musculoskeletal' && details.group === 'form')
    .filter((details) => examObservations[details.field].value)
    .map((details) => parseMusculoskeletalFieldToName(details.field));

  const vitalsTempC =
    getQuestionnaireResponseByLinkId('vitals-temperature', questionnaireResponse)?.answer[0].valueString || 'N/A';
  const vitalsTempF = convertTemperature(vitalsTempC, 'fahrenheit');
  const vitalsTemp = vitalsTempC === 'N/A' ? 'N/A' : `${vitalsTempC}°C / ${vitalsTempF}°F`;
  const vitalsPulse =
    getQuestionnaireResponseByLinkId('vitals-pulse', questionnaireResponse)?.answer[0].valueString || 'N/A';
  const vitalsHR = getQuestionnaireResponseByLinkId('vitals-hr', questionnaireResponse)?.answer[0].valueString || 'N/A';
  const vitalsRR = getQuestionnaireResponseByLinkId('vitals-rr', questionnaireResponse)?.answer[0].valueString || 'N/A';
  const vitalsBP = getQuestionnaireResponseByLinkId('vitals-bp', questionnaireResponse)?.answer[0].valueString || 'N/A';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      {!noTitle && (
        <Typography variant="h5" color="primary.dark">
          Examination
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <AssessmentTitle>Vitals (patient provided):</AssessmentTitle>
          <Typography>
            <b>Temp:</b> {vitalsTemp}
          </Typography>
          <Typography>
            <b>Pulse Ox:</b> {vitalsPulse}
          </Typography>
          <Typography>
            <b>HR:</b> {vitalsHR}
          </Typography>
          <Typography>
            <b>RR:</b> {vitalsRR}
          </Typography>
          <Typography>
            <b>BP:</b> {vitalsBP}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="General:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'general' && ['normal', 'abnormal'].includes(details.group))
              .filter((details) => examObservations[details.field].value)}
            extraItems={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'general' && details.group === 'dropdown')
              .filter((details) => examObservations[details.field].value)
              .map((details) => ({ label: `${details.label} distress`, abnormal: details.abnormal }))}
          />

          <ExamReviewComment item={examObservations['general-comment']} />
        </Box>
      </Box>
    </Box>
  );
};
