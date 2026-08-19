import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { Box, IconButton, MenuItem, Select, TextField, Tooltip, Typography } from '@mui/material';
import { QuestionnaireItemEnableWhen } from 'fhir/r4b';
import { FC } from 'react';
import { PracticeManagedQuestionnaireItem } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { ItemAction } from '../questionnaire.reducer';

// A conditionable target question, resolved with its generated (derived) linkId so an enableWhen
// condition can reference it. Built in QuestionnaireBuilder from the linkId-resolved questionnaire.
export interface AvailableQuestion {
  key: string;
  linkId: string;
  text: string;
  type: string;
  options: string[];
}

const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'exists'] as const;
type Operator = (typeof OPERATORS)[number];

// Builds the default (single) answer field for a freshly (re)configured condition, so exactly one
// answer[x] is ever set: `exists` and boolean targets use answerBoolean; everything else answerString.
const defaultAnswer = (target: AvailableQuestion | undefined, operator: Operator): QuestionnaireItemEnableWhen => {
  const base = { question: target?.linkId ?? '', operator };
  if (operator === 'exists' || target?.type === 'boolean') {
    return { ...base, answerBoolean: true };
  }
  return { ...base, answerString: '' };
};

interface EnableWhenEditorProps {
  item: PracticeManagedQuestionnaireItem;
  dispatch: React.Dispatch<ItemAction>;
  availableQuestions: AvailableQuestion[];
}

export const EnableWhenEditor: FC<EnableWhenEditorProps> = ({ item, dispatch, availableQuestions }) => {
  const conditions = (item.enableWhen ?? []) as QuestionnaireItemEnableWhen[];
  const enableBehavior = (item.enableBehavior as 'all' | 'any' | undefined) ?? 'all';
  // never let a field condition on itself
  const targets = availableQuestions.filter((q) => q.key !== item._key);

  const commit = (next: QuestionnaireItemEnableWhen[]): void => {
    dispatch({ type: 'UPDATE_ITEM', key: item._key, field: 'enableWhen', value: next.length ? next : undefined });
  };

  const replaceCondition = (index: number, next: QuestionnaireItemEnableWhen): void => {
    commit(conditions.map((c, i) => (i === index ? next : c)));
  };

  const addCondition = (): void => {
    commit([...conditions, defaultAnswer(targets[0], '=')]);
  };

  const removeCondition = (index: number): void => {
    commit(conditions.filter((_, i) => i !== index));
  };

  const targetFor = (linkId: string): AvailableQuestion | undefined => targets.find((t) => t.linkId === linkId);

  return (
    <Box sx={{ mt: 0.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Show this item only when…
      </Typography>

      {conditions.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Always shown. Add a condition to show it only when another answer matches.
        </Typography>
      )}

      {conditions.map((condition, index) => {
        const target = targetFor(condition.question);
        const operator = (condition.operator as Operator) ?? '=';
        const isExists = operator === 'exists';
        const isBooleanAnswer = isExists || target?.type === 'boolean';

        return (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
            <Select
              size="small"
              value={targets.some((t) => t.linkId === condition.question) ? condition.question : ''}
              displayEmpty
              onChange={(e) => replaceCondition(index, defaultAnswer(targetFor(e.target.value), operator))}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="" disabled>
                Select a question
              </MenuItem>
              {targets.map((t) => (
                <MenuItem key={t.key} value={t.linkId}>
                  {t.text || t.linkId}
                </MenuItem>
              ))}
            </Select>

            <Select
              size="small"
              value={operator}
              onChange={(e) => replaceCondition(index, defaultAnswer(target, e.target.value as Operator))}
              sx={{ minWidth: 90 }}
            >
              {OPERATORS.map((op) => (
                <MenuItem key={op} value={op}>
                  {op}
                </MenuItem>
              ))}
            </Select>

            {!isExists && isBooleanAnswer && (
              <Select
                size="small"
                value={condition.answerBoolean ? 'true' : 'false'}
                onChange={(e) =>
                  replaceCondition(index, {
                    question: condition.question,
                    operator,
                    answerBoolean: e.target.value === 'true',
                  })
                }
                sx={{ minWidth: 90 }}
              >
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </Select>
            )}

            {isExists && (
              <Select
                size="small"
                value={condition.answerBoolean === false ? 'false' : 'true'}
                onChange={(e) =>
                  replaceCondition(index, {
                    question: condition.question,
                    operator,
                    answerBoolean: e.target.value === 'true',
                  })
                }
                sx={{ minWidth: 110 }}
              >
                <MenuItem value="true">is answered</MenuItem>
                <MenuItem value="false">is empty</MenuItem>
              </Select>
            )}

            {!isExists && !isBooleanAnswer && (target?.options.length ?? 0) > 0 && (
              <Select
                size="small"
                value={target?.options.includes(condition.answerString ?? '') ? condition.answerString : ''}
                displayEmpty
                onChange={(e) =>
                  replaceCondition(index, { question: condition.question, operator, answerString: e.target.value })
                }
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="" disabled>
                  Select a value
                </MenuItem>
                {target!.options.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
            )}

            {!isExists && !isBooleanAnswer && (target?.options.length ?? 0) === 0 && (
              <TextField
                size="small"
                placeholder="answer"
                value={condition.answerString ?? ''}
                onChange={(e) =>
                  replaceCondition(index, { question: condition.question, operator, answerString: e.target.value })
                }
                sx={{ minWidth: 140 }}
              />
            )}

            <Tooltip title="Remove condition">
              <IconButton size="small" color="error" onClick={() => removeCondition(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title={targets.length === 0 ? 'Add another question to the form first' : 'Add condition'}>
          <span>
            <IconButton size="small" color="primary" onClick={addCondition} disabled={targets.length === 0}>
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {conditions.length > 1 && (
          <Select
            size="small"
            value={enableBehavior}
            onChange={(e) =>
              dispatch({ type: 'UPDATE_ITEM', key: item._key, field: 'enableBehavior', value: e.target.value })
            }
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="all">All conditions must match</MenuItem>
            <MenuItem value="any">Any condition can match</MenuItem>
          </Select>
        )}
      </Box>
    </Box>
  );
};
