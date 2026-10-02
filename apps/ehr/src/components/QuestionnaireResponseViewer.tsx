import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { ReactElement, useMemo } from 'react';
import {
  formatQuestionnaireItemValueToString,
  getScoredFormResults,
  getVisiblePages,
} from 'utils/lib/helpers/practice-managed-questionnaires';
import { IntakeQuestionnaireItem } from 'utils/lib/types/data/paperwork/paperwork.types';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

export const QuestionnaireResponseViewer = ({ form }: { form: StandaloneFormDTO }): ReactElement => {
  const { allItems, questionnaireResponse } = form;

  // computed results of a scored form (answers to score expression items on its hidden results page)
  const scores = useMemo(
    () => getScoredFormResults(allItems, questionnaireResponse.item ?? []),
    [allItems, questionnaireResponse.item]
  );

  // Build a flat map of linkId → answer from the response
  const answerMap = useMemo(() => {
    const map = new Map<string, string>();
    const walkItems = (items: QuestionnaireResponseItem[]): void => {
      for (const item of items) {
        if (item.answer && item.answer.length > 0) {
          const answer = formatQuestionnaireItemValueToString(item);
          map.set(item.linkId, answer);
        }
        if (item.item) walkItems(item.item);
      }
    };
    walkItems(questionnaireResponse.item ?? []);
    return map;
  }, [questionnaireResponse.item]);

  // patient answers only: hidden pages (e.g. a scored form's results page) are shown separately as results
  const flattenQuestions = getVisiblePages(allItems)
    .flatMap((item) => item.item)
    .filter((q): q is IntakeQuestionnaireItem => q !== undefined && q.type !== 'display');

  if (answerMap.size === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Not Started
      </Typography>
    );
  }

  return (
    <Box>
      {flattenQuestions?.map((q) => {
        const answer = answerMap.get(q.linkId);

        return (
          <Box key={q.linkId} sx={{ py: 0.5 }}>
            <Typography variant="body2">
              <Box component="span" sx={{ color: 'primary.dark' }}>
                {q.text}:
              </Box>{' '}
              {answer}
            </Typography>
          </Box>
        );
      })}
      {scores.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.dark', fontWeight: 700, mb: 0.5 }}>
            Results
          </Typography>
          {scores.map((score) => (
            <Box key={score.linkId} sx={{ py: 0.5 }}>
              <Typography variant="body2">
                <Box component="span" sx={{ color: 'primary.dark' }}>
                  {score.text}:
                </Box>{' '}
                {score.value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
