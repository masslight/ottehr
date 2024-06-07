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
import { ActionsList } from '../../../../components';
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

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Head:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'head')
              .filter((details) => examObservations[details.field].value)}
          />

          <ExamReviewComment item={examObservations['head-comment']} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Eyes:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'eyes' && ['normal', 'abnormal'].includes(details.group))
              .filter((details) => examObservations[details.field].value)}
          />

          <ExamReviewGroup
            label="Right eye:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.group === 'rightEye')
              .map((details) => ({ ...details, value: examObservations[details.field].value! }))}
            radio
          />

          <ExamReviewGroup
            label="Left eye:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.group === 'leftEye')
              .map((details) => ({ ...details, value: examObservations[details.field].value! }))}
            radio
          />

          <ExamReviewComment item={examObservations['eyes-comment']} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Right ear:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.group === 'rightEar')
              .map((details) => ({ ...details, value: examObservations[details.field].value! }))}
            radio
          />

          <ExamReviewGroup
            label="Left ear:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.group === 'leftEar')
              .map((details) => ({ ...details, value: examObservations[details.field].value! }))}
            radio
          />

          <ExamReviewComment item={examObservations['ears-comment']} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Mouth:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'mouth')
              .filter((details) => examObservations[details.field].value)}
          />

          <ExamReviewComment item={examObservations['mouth-comment']} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Neck:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'neck')
              .filter((details) => examObservations[details.field].value)}
          />

          <ExamReviewComment item={examObservations['neck-comment']} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Chest:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'chest')
              .filter((details) => examObservations[details.field].value)}
          />

          <ExamReviewComment item={examObservations['chest-comment']} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Back:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'back')
              .filter((details) => examObservations[details.field].value)}
          />

          <ExamReviewComment item={examObservations['back-comment']} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Skin:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'skin' && ['normal', 'abnormal'].includes(details.group))
              .filter((details) => examObservations[details.field].value)}
            extraItems={rashesLabels.length > 0 ? [{ label: 'Rashes', abnormal: true }] : undefined}
          />

          {rashesLabels.length > 0 && <Typography>{rashesLabels.join(', ')}</Typography>}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Abdomen:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'abdomen')
              .filter((details) => examObservations[details.field].value)}
          />

          <ExamReviewComment item={examObservations['chest-comment']} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Extremities/Musculoskeletal:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'musculoskeletal' && ['normal', 'abnormal'].includes(details.group))
              .filter((details) => examObservations[details.field].value)}
            extraItems={abnormalMusculoskeletalLabels.length > 0 ? [{ label: 'Abnormal', abnormal: true }] : undefined}
          />

          {abnormalMusculoskeletalLabels.length > 0 && (
            <Box sx={{ maxWidth: '400px' }}>
              <ActionsList
                data={abnormalMusculoskeletalLabels}
                getKey={(value) => value}
                renderItem={(value) => value}
                divider
                gap={0.5}
              />
            </Box>
          )}

          <ExamReviewComment item={examObservations['extremities-musculoskeletal-comment']} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Neurological:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'neurological')
              .filter((details) => examObservations[details.field].value)}
          />

          <ExamReviewComment item={examObservations['neurological-comment']} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup
            label="Psych:"
            items={examObservationFieldsDetailsArray
              .filter((details) => details.card === 'psych')
              .filter((details) => examObservations[details.field].value)}
          />

          <ExamReviewComment item={examObservations['psych-comment']} />
        </Box>
      </Box>
    </Box>
  );
};
