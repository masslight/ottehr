import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import {
  ASQ_FIELD,
  ASQKeys,
  asqLabels,
  convertBooleanToString,
  CustomOptionObservationHistoryObtainedFromDTO,
  HISTORY_OBTAINED_FROM_FIELD,
  HistorySourceKeys,
  historySourceLabels,
  NoteDTO,
  ObservationBooleanFieldDTO,
  ObservationHistoryObtainedFromDTO,
  ObservationSeenInLastThreeYearsDTO,
  recentVisitLabels,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
  SEEN_IN_LAST_THREE_YEARS_LABEL,
} from 'utils';
import { ADDITIONAL_QUESTIONS } from '../../../../../constants';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useChartData } from '../../../../state';
import { AssessmentTitle } from '../../AssessmentTab';

type AdditionalQuestionsContainerProps = {
  notes?: NoteDTO[];
};

export const AdditionalQuestionsContainer: FC<AdditionalQuestionsContainerProps> = ({ notes }) => {
  const { chartData } = useChartData();

  const seenInLastThreeYearsObs = chartData?.observations?.find(
    (obs) => obs.field === SEEN_IN_LAST_THREE_YEARS_FIELD
  ) as ObservationSeenInLastThreeYearsDTO | undefined;

  const historyObtainedFromObs = chartData?.observations?.find((obs) => obs.field === HISTORY_OBTAINED_FROM_FIELD) as
    | ObservationHistoryObtainedFromDTO
    | undefined;

  const currentASQObs = chartData?.observations?.find((obs) => obs.field === ASQ_FIELD);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Additional questions
      </Typography>
      {ADDITIONAL_QUESTIONS.map((question, index) => {
        const value = convertBooleanToString(
          (
            chartData?.observations?.find(
              (observation) => observation.field === question.field
            ) as ObservationBooleanFieldDTO
          )?.value
        );

        return value && value.length > 0 ? (
          <Box
            key={question.field}
            data-testid={dataTestIds.telemedEhrFlow.reviewTabAdditionalQuestion(question.field)}
          >
            <Typography key={index}>{`${question.label} - ${value}`}</Typography>
          </Box>
        ) : null;
      })}

      {seenInLastThreeYearsObs && (
        <Typography>{`${SEEN_IN_LAST_THREE_YEARS_LABEL} - ${
          recentVisitLabels[seenInLastThreeYearsObs.value]
        }`}</Typography>
      )}

      {historyObtainedFromObs && (
        <Typography>
          {`History obtained from - ${historySourceLabels[historyObtainedFromObs.value]}`}
          {historyObtainedFromObs.value === HistorySourceKeys.NotObtainedOther
            ? `: ${(historyObtainedFromObs as CustomOptionObservationHistoryObtainedFromDTO).note}`
            : ''}
        </Typography>
      )}

      {currentASQObs && <Typography>{`ASQ - ${asqLabels[currentASQObs.value as ASQKeys]}`}</Typography>}

      {notes && notes.length > 0 && (
        <>
          <AssessmentTitle>Screening notes</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes?.map((note) => <Typography key={note.resourceId}>{note.text}</Typography>)}
          </Box>
        </>
      )}
    </Box>
  );
};
