import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { Box, IconButton, MenuItem, Select, TextField, Tooltip, Typography } from '@mui/material';
import { FormFieldTrigger } from 'config-types';
import { FC } from 'react';
import { PracticeManagedQuestionnaireItem } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { ItemAction } from '../questionnaire.reducer';

// A conditionable target question, resolved with its generated (derived) linkId so a trigger can
// reference it. Built in QuestionnaireBuilder from the linkId-resolved questionnaire. `pageLinkId`/`pageText`
// record the owning top-level page so a page-level trigger can build the cross-page dotted reference.
export interface AvailableQuestion {
  key: string;
  linkId: string;
  pageLinkId: string;
  pageText: string;
  text: string;
  type: string;
  options: string[];
}

// A resolved picker option: `value` is exactly what gets stored in the trigger's targetQuestionLinkId —
// a plain linkId for same-form field triggers, or the dotted `pageLinkId.fieldLinkId` for page triggers.
interface TriggerTarget {
  key: string;
  value: string;
  label: string;
  type: string;
  options: string[];
}

type Effect = 'enable' | 'require' | 'filter' | 'sub-text';

type TriggerMode = 'field' | 'page';

const EFFECTS: { value: Effect; label: string }[] = [
  { value: 'enable', label: 'Show this field when…' },
  { value: 'require', label: 'Require this field when…' },
  { value: 'filter', label: 'Filter its options when…' },
  { value: 'sub-text', label: 'Change its sub-text when…' },
];

// Ordering operators (> < >= <=) only work at runtime for date-target enable triggers; everywhere else
// they throw or silently no-op, so the editor only offers exists / = / != outside that one case.
const BASE_OPERATORS = ['exists', '=', '!='] as const;
const DATE_ENABLE_OPERATORS = ['exists', '=', '!=', '>', '<', '>=', '<='] as const;
type Operator = (typeof DATE_ENABLE_OPERATORS)[number];

type AnswerPatch = Pick<FormFieldTrigger, 'answerBoolean' | 'answerString' | 'answerDateTime'>;

const operatorsFor = (effect: Effect, target: TriggerTarget | undefined): readonly Operator[] =>
  effect === 'enable' && target?.type === 'date' ? DATE_ENABLE_OPERATORS : BASE_OPERATORS;

// Build the default (single) answer field for a freshly (re)configured trigger, so exactly one answer[x]
// is ever set (per FormFieldTriggerSchema). Date answers only round-trip for enable triggers, so require/
// filter/sub-text triggers fall through to answerString even for a date target.
const defaultAnswerFor = (target: TriggerTarget | undefined, operator: Operator, effect: Effect): AnswerPatch => {
  if (operator === 'exists') return { answerBoolean: true };
  if (target?.type === 'boolean') return { answerBoolean: true };
  if (target?.type === 'date' && effect === 'enable') return { answerDateTime: '' };
  return { answerString: '' };
};

const pickAnswer = (trigger: FormFieldTrigger): AnswerPatch => {
  if (trigger.answerBoolean !== undefined) return { answerBoolean: trigger.answerBoolean };
  if (trigger.answerDateTime !== undefined) return { answerDateTime: trigger.answerDateTime };
  return { answerString: trigger.answerString ?? '' };
};

const makeTrigger = (
  effect: Effect,
  target: TriggerTarget | undefined,
  operator: Operator,
  answer: AnswerPatch,
  substituteText?: string
): FormFieldTrigger => ({
  targetQuestionLinkId: target?.value ?? '',
  effect: [effect],
  operator,
  ...answer,
  ...(effect === 'sub-text' ? { substituteText: substituteText ?? '' } : {}),
});

interface FieldTriggersEditorProps {
  item: PracticeManagedQuestionnaireItem;
  dispatch: React.Dispatch<ItemAction>;
  availableQuestions: AvailableQuestion[];
  // 'field' (default): condition this field on any other question (same form), stored as a plain linkId.
  // 'page': condition this whole page on a field from another page, stored as `pageLinkId.fieldLinkId`.
  mode?: TriggerMode;
}

export const FieldTriggersEditor: FC<FieldTriggersEditorProps> = ({
  item,
  dispatch,
  availableQuestions,
  mode = 'field',
}) => {
  const triggers = (item.triggers ?? []) as FormFieldTrigger[];
  const enableBehavior = (item.enableBehavior as 'all' | 'any' | undefined) ?? 'all';
  const isPageMode = mode === 'page';

  // page triggers reference a field on ANOTHER page (dotted value); field triggers reference any other
  // question by plain linkId. Never let an item condition on itself, and never let a page condition on its
  // own child (it would depend on a field it hides).
  const targets: TriggerTarget[] = isPageMode
    ? availableQuestions
        .filter((q) => q.pageLinkId && q.pageLinkId !== item.linkId)
        .map((q) => ({
          key: q.key,
          value: `${q.pageLinkId}.${q.linkId}`,
          label: `${q.pageText || q.pageLinkId} → ${q.text || q.linkId}`,
          type: q.type,
          options: q.options,
        }))
    : availableQuestions
        .filter((q) => q.key !== item._key)
        .map((q) => ({ key: q.key, value: q.linkId, label: q.text || q.linkId, type: q.type, options: q.options }));

  const targetFor = (value: string): TriggerTarget | undefined => targets.find((t) => t.value === value);

  const effectOptions = isPageMode ? EFFECTS.filter((e) => e.value === 'enable') : EFFECTS;
  const requireTriggerCount = triggers.filter((t) => t.effect.includes('require')).length;
  const enableTriggerCount = triggers.filter((t) => t.effect.includes('enable')).length;

  const commit = (next: FormFieldTrigger[]): void => {
    dispatch({ type: 'UPDATE_ITEM', key: item._key, field: 'triggers', value: next.length ? next : undefined });
  };

  const replaceTrigger = (index: number, next: FormFieldTrigger): void => {
    commit(triggers.map((t, i) => (i === index ? next : t)));
  };

  const addTrigger = (): void => {
    // new triggers default to the always-allowed 'enable' effect (the only effect in page mode)
    commit([...triggers, makeTrigger('enable', targets[0], '=', defaultAnswerFor(targets[0], '=', 'enable'))]);
  };

  const removeTrigger = (index: number): void => {
    commit(triggers.filter((_, i) => i !== index));
  };

  const changeEffect = (index: number, effect: Effect): void => {
    const trigger = triggers[index];
    const target = targetFor(trigger.targetQuestionLinkId);
    const allowed = operatorsFor(effect, target);
    const operator = allowed.includes(trigger.operator as Operator) ? (trigger.operator as Operator) : '=';
    const answer = defaultAnswerFor(target, operator, effect);
    replaceTrigger(index, makeTrigger(effect, target, operator, answer, trigger.substituteText));
  };

  const changeTarget = (index: number, value: string): void => {
    const trigger = triggers[index];
    const effect = (trigger.effect[0] ?? 'enable') as Effect;
    const target = targetFor(value);
    const allowed = operatorsFor(effect, target);
    const operator = allowed.includes(trigger.operator as Operator) ? (trigger.operator as Operator) : '=';
    replaceTrigger(
      index,
      makeTrigger(effect, target, operator, defaultAnswerFor(target, operator, effect), trigger.substituteText)
    );
  };

  const changeOperator = (index: number, operator: Operator): void => {
    const trigger = triggers[index];
    const effect = (trigger.effect[0] ?? 'enable') as Effect;
    const target = targetFor(trigger.targetQuestionLinkId);
    const wasExists = trigger.operator === 'exists';
    const isExists = operator === 'exists';
    // preserve the typed answer when switching between comparison operators; reset only around `exists`
    const answer = isExists || wasExists ? defaultAnswerFor(target, operator, effect) : pickAnswer(trigger);
    replaceTrigger(index, makeTrigger(effect, target, operator, answer, trigger.substituteText));
  };

  const changeAnswer = (index: number, answer: AnswerPatch): void => {
    const trigger = triggers[index];
    const effect = (trigger.effect[0] ?? 'enable') as Effect;
    const target = targetFor(trigger.targetQuestionLinkId);
    replaceTrigger(index, makeTrigger(effect, target, trigger.operator as Operator, answer, trigger.substituteText));
  };

  const changeSubstituteText = (index: number, substituteText: string): void => {
    const trigger = triggers[index];
    const effect = (trigger.effect[0] ?? 'enable') as Effect;
    const target = targetFor(trigger.targetQuestionLinkId);
    replaceTrigger(
      index,
      makeTrigger(effect, target, trigger.operator as Operator, pickAnswer(trigger), substituteText)
    );
  };

  return (
    <Box sx={{ mt: 0.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {isPageMode ? 'Show this page when…' : 'Field trigger(s)'}
      </Typography>

      {triggers.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {isPageMode
            ? 'This page is always shown. Add a condition to show it only when an earlier answer matches.'
            : 'No triggers. Add one to show, require, filter, or re-word this field based on another answer.'}
        </Typography>
      )}

      {triggers.map((trigger, index) => {
        const effect = (trigger.effect[0] ?? 'enable') as Effect;
        const target = targetFor(trigger.targetQuestionLinkId);
        const operator = (trigger.operator as Operator) ?? '=';
        const allowedOperators = operatorsFor(effect, target);
        const isExists = operator === 'exists';
        const isBooleanAnswer = isExists || target?.type === 'boolean';
        const isDateAnswer = !isExists && target?.type === 'date' && effect === 'enable';

        return (
          <Box
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 0.75,
              flexWrap: 'wrap',
              borderLeft: '3px solid #E0E0E0',
              pl: 1,
            }}
          >
            {/* page triggers only enable, so the effect selector is redundant (the heading says "Show this page when…") */}
            {!isPageMode && (
              <Select
                size="small"
                value={effect}
                onChange={(e) => changeEffect(index, e.target.value as Effect)}
                sx={{ minWidth: 190 }}
              >
                {effectOptions.map((ef) => (
                  <MenuItem
                    key={ef.value}
                    value={ef.value}
                    // only the first require-when is honored at runtime, so allow at most one require trigger
                    disabled={ef.value === 'require' && effect !== 'require' && requireTriggerCount >= 1}
                  >
                    {ef.label}
                  </MenuItem>
                ))}
              </Select>
            )}

            <Select
              size="small"
              value={targets.some((t) => t.value === trigger.targetQuestionLinkId) ? trigger.targetQuestionLinkId : ''}
              displayEmpty
              onChange={(e) => changeTarget(index, e.target.value)}
              sx={{ minWidth: isPageMode ? 240 : 170 }}
            >
              <MenuItem value="" disabled>
                Select a question
              </MenuItem>
              {targets.map((t) => (
                <MenuItem key={t.key} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>

            <Select
              size="small"
              value={operator}
              onChange={(e) => changeOperator(index, e.target.value as Operator)}
              sx={{ minWidth: 80 }}
            >
              {allowedOperators.map((op) => (
                <MenuItem key={op} value={op}>
                  {op}
                </MenuItem>
              ))}
            </Select>

            {isExists && (
              <Select
                size="small"
                value={trigger.answerBoolean === false ? 'false' : 'true'}
                onChange={(e) => changeAnswer(index, { answerBoolean: e.target.value === 'true' })}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="true">is answered</MenuItem>
                <MenuItem value="false">is empty</MenuItem>
              </Select>
            )}

            {!isExists && isBooleanAnswer && (
              <Select
                size="small"
                value={trigger.answerBoolean ? 'true' : 'false'}
                onChange={(e) => changeAnswer(index, { answerBoolean: e.target.value === 'true' })}
                sx={{ minWidth: 90 }}
              >
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </Select>
            )}

            {isDateAnswer && (
              <TextField
                size="small"
                type="date"
                value={trigger.answerDateTime ?? ''}
                onChange={(e) => changeAnswer(index, { answerDateTime: e.target.value })}
                sx={{ minWidth: 150 }}
              />
            )}

            {!isExists && !isBooleanAnswer && !isDateAnswer && (target?.options.length ?? 0) > 0 && (
              <Select
                size="small"
                value={target?.options.includes(trigger.answerString ?? '') ? trigger.answerString : ''}
                displayEmpty
                onChange={(e) => changeAnswer(index, { answerString: e.target.value })}
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

            {!isExists && !isBooleanAnswer && !isDateAnswer && (target?.options.length ?? 0) === 0 && (
              <TextField
                size="small"
                placeholder="answer"
                value={trigger.answerString ?? ''}
                onChange={(e) => changeAnswer(index, { answerString: e.target.value })}
                sx={{ minWidth: 140 }}
              />
            )}

            {effect === 'sub-text' && (
              <TextField
                size="small"
                placeholder="Replacement sub-text"
                value={trigger.substituteText ?? ''}
                onChange={(e) => changeSubstituteText(index, e.target.value)}
                sx={{ flexGrow: 1, minWidth: 180 }}
              />
            )}

            <Tooltip title="Remove trigger">
              <IconButton size="small" color="error" onClick={() => removeTrigger(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip
          title={
            targets.length === 0
              ? isPageMode
                ? 'Add a field on another page first'
                : 'Add another question to the form first'
              : 'Add condition'
          }
        >
          <span>
            <IconButton size="small" color="primary" onClick={addTrigger} disabled={targets.length === 0}>
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {enableTriggerCount > 1 && (
          <Select
            size="small"
            value={enableBehavior}
            onChange={(e) =>
              dispatch({ type: 'UPDATE_ITEM', key: item._key, field: 'enableBehavior', value: e.target.value })
            }
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All "show" conditions must match</MenuItem>
            <MenuItem value="any">Any "show" condition can match</MenuItem>
          </Select>
        )}
      </Box>
    </Box>
  );
};
