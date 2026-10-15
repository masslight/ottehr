import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { ReactElement, useMemo } from 'react';
import { coerceCalculatedAnswers } from 'utils/lib/helpers/paperwork/calculated-answers';
import { evaluateCalculatedItems, formatCalculatedValue } from 'utils/lib/helpers/paperwork/calculated-expressions';
import { formatQuestionnaireItemValueToString } from 'utils/lib/helpers/practice-managed-questionnaires';
import { IntakeQuestionnaireItem } from 'utils/lib/types/data/paperwork/paperwork.types';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

// every answerable item, however deeply its groups are nested
const collectQuestions = (items: IntakeQuestionnaireItem[] | undefined): IntakeQuestionnaireItem[] =>
  (items ?? []).flatMap((item) => (item.type === 'group' ? collectQuestions(item.item) : [item]));

const findResponseItem = (
  items: QuestionnaireResponseItem[] | undefined,
  linkId: string
): QuestionnaireResponseItem | undefined => {
  for (const item of items ?? []) {
    if (item.linkId === linkId) return item;
    const nested = findResponseItem(item.item, linkId);
    if (nested) return nested;
  }
  return undefined;
};

export const QuestionnaireResponseViewer = ({ form }: { form: StandaloneFormDTO }): ReactElement => {
  const { allItems, questionnaireResponse } = form;

  const questions = useMemo(
    () => collectQuestions(allItems.flatMap((item) => item.item ?? [])).filter((q) => q.type !== 'display'),
    [allItems]
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

  // lets us validate the recorded answer is correct; we will show a flag if it differs or is missing
  // we will always use the live / most correct value
  const recalculated = useMemo(
    () => evaluateCalculatedItems(allItems, questionnaireResponse.item),
    [allItems, questionnaireResponse.item]
  );

  // a calculated value being recorded does not mean the form was started: it may be a partial score
  const hasAnswers = questions.some((q) => !q.calculatedExpression && answerMap.has(q.linkId));
  if (!hasAnswers) {
    return (
      <Typography variant="body2" color="text.secondary">
        Not Started
      </Typography>
    );
  }

  return (
    <Box>
      {questions.map((q) => {
        let answer: string | undefined;
        let note: string | undefined;

        if (q.calculatedExpression) {
          const recorded = findResponseItem(questionnaireResponse.item, q.linkId);
          const recordedAnswers = recorded?.answer ?? [];
          const live = recalculated[q.linkId];
          answer = formatCalculatedValue(live, q);

          // flag if there are any discrepancies between live and stored: compared as recorded, so a coded or
          // repeating value is checked answer by answer
          if (live !== undefined) {
            if (recordedAnswers.length === 0) {
              note = 'differs from the recorded answers (no value was recorded on the response)';
            } else if (JSON.stringify(recordedAnswers) !== JSON.stringify(coerceCalculatedAnswers(q, live) ?? [])) {
              note = `differs from the recorded answers (recalculated: ${answer})`;
            }
          } else if (recorded && recordedAnswers.length > 0) {
            note = `differs from the recorded answers (${formatQuestionnaireItemValueToString(recorded)})`;
          }
        } else {
          answer = answerMap.get(q.linkId);
        }

        return (
          <Box key={q.linkId} sx={{ py: 0.5 }}>
            <Typography variant="body2">
              <Box component="span" sx={{ color: 'primary.dark' }}>
                {q.text}:
              </Box>{' '}
              {answer}
              {note && (
                <Box
                  component="span"
                  sx={{ color: 'warning.dark', ml: 1 }}
                  data-testid={`calculated-mismatch-${q.linkId}`}
                >
                  ({note})
                </Box>
              )}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};
