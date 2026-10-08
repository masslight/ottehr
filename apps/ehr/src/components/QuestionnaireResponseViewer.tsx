import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { ReactElement, useMemo } from 'react';
import { evaluateCalculatedItems, formatCalculatedValue } from 'utils/lib/helpers/paperwork/calculated-expressions';
import { formatQuestionnaireItemValueToString } from 'utils/lib/helpers/practice-managed-questionnaires';
import { IntakeQuestionnaireItem } from 'utils/lib/types/data/paperwork/paperwork.types';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

// every answerable item, however deeply its groups are nested
const collectQuestions = (items: IntakeQuestionnaireItem[] | undefined): IntakeQuestionnaireItem[] =>
  (items ?? []).flatMap((item) => (item.type === 'group' ? collectQuestions(item.item) : [item]));

export const QuestionnaireResponseViewer = ({ form }: { form: StandaloneFormDTO }): ReactElement => {
  const { allItems, questionnaireResponse } = form;

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

  // formula fields are never stored on the response: they are worked out from the answers that were recorded.
  // the EHR shows them even when the form hides them from the patient
  const calculatedValues = useMemo(
    () => evaluateCalculatedItems(allItems, questionnaireResponse.item),
    [allItems, questionnaireResponse.item]
  );

  const flattenQuestions = collectQuestions(allItems.flatMap((item) => item.item ?? [])).filter(
    (q) => q.type !== 'display'
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
      {flattenQuestions?.map((q) => {
        const answer = q.calculatedExpression
          ? formatCalculatedValue(calculatedValues[q.linkId])
          : answerMap.get(q.linkId);

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
    </Box>
  );
};
