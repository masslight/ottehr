import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { ReactElement, useMemo } from 'react';
import { CalculatedValue } from 'utils/lib/helpers/paperwork/calculated-answers';
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

// the value a calculated item was recorded with, what is on the questionnaire response
const storedCalculatedValue = (item: QuestionnaireResponseItem | undefined): CalculatedValue => {
  const answer = item?.answer?.[0];
  return answer?.valueBoolean ?? answer?.valueInteger ?? answer?.valueDecimal ?? answer?.valueString;
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

  if (answerMap.size === 0) {
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
          const stored = storedCalculatedValue(findResponseItem(questionnaireResponse.item, q.linkId));
          const live = recalculated[q.linkId];
          answer = formatCalculatedValue(live);

          // flag if there are any discrepancies between live and stored
          if (live !== undefined) {
            if (stored === undefined) {
              note = 'differs from the recorded answers (no value was recorded on the response)';
            } else if (formatCalculatedValue(live) !== answer) {
              note = `differs from the recorded answers (recalculated: ${formatCalculatedValue(live)})`;
            }
          } else if (stored !== undefined) {
            note = `differs from the recorded answers (${stored})`;
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
