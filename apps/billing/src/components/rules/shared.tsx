import { Box, FormControl, InputLabel, MenuItem, Popover, Select, TextField } from '@mui/material';
import { MouseEvent, ReactElement, ReactNode, useState } from 'react';
import {
  getRuleFieldDef,
  HOLD_TAG_NAME,
  RULE_FIELD_CATALOG,
  RULE_OPERATORS,
  RuleAction,
  RuleCondition,
  RuleConditional,
  RuleOperator,
  RuleOutcome,
} from 'utils';
import { PayerSelect } from './PayerSelect';

// ---------------------------------------------------------------------------
// Shared rule-editing primitives
//
// The rule data model (RuleConditional / RuleCondition / RuleAction / RuleOutcome) is a single
// contract, but it can be *presented* for editing in more than one way. This module holds everything
// that is presentation-agnostic — factories for new nodes, the operator/value plumbing, the leaf
// field/action editors, and human-readable describers — so each editor variant (form builder,
// outline, flow) can focus purely on how it lays the logic out, not on the mechanics of a field.
// ---------------------------------------------------------------------------

export const SETTABLE_FIELDS = RULE_FIELD_CATALOG.filter((f) => f.settable);
export const FIRST_FIELD_ID = RULE_FIELD_CATALOG[0]?.id ?? 'payerId';
export const FIRST_SETTABLE_ID = SETTABLE_FIELDS[0]?.id ?? 'payerId';

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  eq: 'equals',
  neq: 'does not equal',
  in: 'is one of',
  notIn: 'is not one of',
  contains: 'contains',
  notContains: 'does not contain',
  exists: 'is present',
  notExists: 'is empty',
};

export const operatorNeedsValue = (op: RuleOperator): boolean => op !== 'exists' && op !== 'notExists';
export const operatorIsMultiValue = (op: RuleOperator): boolean => op === 'in' || op === 'notIn';

export const valueToText = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value.join(', ') : value ?? '';

export const textToList = (text: string): string[] =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// --- factories ---

export const newFieldCondition = (): RuleCondition => ({
  type: 'field',
  field: FIRST_FIELD_ID,
  operator: 'eq',
  value: '',
});
export const newAction = (): RuleAction => ({ type: 'setField', field: FIRST_SETTABLE_ID, value: '' });
export const newOutcome = (): RuleOutcome => ({ type: 'actions', actions: [newAction()] });
export const newBranch = (): RuleConditional['branches'][number] => ({
  condition: newFieldCondition(),
  outcome: newOutcome(),
});
export const newRuleConditional = (): RuleConditional => ({ branches: [newBranch()] });

// --- human-readable describers (used by the read-first variants) ---

export const describeField = (id: string): string => getRuleFieldDef(id)?.label ?? id;

const quoteValue = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value.length ? value.map((v) => `“${v}”`).join(' or ') : '(none)';
  return value && value.length ? `“${value}”` : '(empty)';
};

// A one-line, sentence-like rendering of a leaf field condition, e.g. `Payer ID equals “123456”` or
// `Patient gender is present`. Group/all conditions are laid out structurally by each variant, so
// only the field case produces a full sentence here.
export const describeFieldCondition = (c: Extract<RuleCondition, { type: 'field' }>): string => {
  const op = OPERATOR_LABELS[c.operator];
  return operatorNeedsValue(c.operator)
    ? `${describeField(c.field)} ${op} ${quoteValue(c.value)}`
    : `${describeField(c.field)} ${op}`;
};

export const describeAction = (a: RuleAction): string => {
  if (a.type === 'noop') return 'Do nothing';
  if (a.type === 'applyTag') {
    return a.tag === HOLD_TAG_NAME ? `Hold the claim (tag “${a.tag}”)` : `Apply tag “${a.tag || '…'}”`;
  }
  const value = a.value ?? '';
  return value ? `Set ${describeField(a.field)} to “${value}”` : `Clear ${describeField(a.field)}`;
};

const indentSx = { borderLeft: '2px solid', borderColor: 'divider', pl: 2, ml: 0.5 };
export { indentSx };

// ---------------------------------------------------------------------------
// Leaf editors — the actual inputs for one condition / one action. These are shared verbatim by
// every variant; what differs between variants is only how/when they are surfaced (always-on form,
// click-to-edit popover, flow-node panel).
// ---------------------------------------------------------------------------

// A click-to-edit surface used by the read-first variants (outline, flow): the trigger renders a
// plain-English summary, and clicking it pops over the actual editing form. Keeps those variants
// uncluttered until the user wants to change one piece.
export function PopoverEditable({
  trigger,
  children,
  width = 540,
}: {
  trigger: (open: (e: MouseEvent<HTMLElement>) => void) => ReactNode;
  children: ReactNode;
  width?: number;
}): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      {trigger((e) => setAnchor(e.currentTarget))}
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, maxWidth: width }}>{children}</Box>
      </Popover>
    </>
  );
}

// Field-aware value input: payer fields get the searchable payer picker; everything else is free
// text (multi-value operators take a comma-separated list).
export function FieldValueInput({
  fieldId,
  multiple,
  value,
  onChange,
  label,
}: {
  fieldId: string;
  multiple: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
}): ReactElement {
  if (fieldId === 'payerId') {
    return <PayerSelect multiple={multiple} value={value} onChange={onChange} label={label} />;
  }
  return (
    <TextField
      size="small"
      label={label ?? (multiple ? 'Values (comma-separated)' : 'Value')}
      value={valueToText(value ?? '')}
      onChange={(e) => onChange(multiple ? textToList(e.target.value) : e.target.value)}
      sx={{ minWidth: 200 }}
    />
  );
}

// The property / operator / value inputs for a single `field` condition.
export function FieldConditionFields({
  value,
  onChange,
}: {
  value: Extract<RuleCondition, { type: 'field' }>;
  onChange: (next: RuleCondition) => void;
}): ReactElement {
  const def = getRuleFieldDef(value.field);
  const operators = def?.operators ?? [...RULE_OPERATORS];
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Property</InputLabel>
        <Select
          label="Property"
          value={value.field}
          onChange={(e) => {
            const field = e.target.value;
            const nextDef = getRuleFieldDef(field);
            const operator =
              nextDef && !nextDef.operators.includes(value.operator) ? nextDef.operators[0] : value.operator;
            // Reset the value: it's meaningless across a property change (e.g. payer id -> gender).
            onChange({ ...value, field, operator, value: '' });
          }}
        >
          {RULE_FIELD_CATALOG.map((f) => (
            <MenuItem key={f.id} value={f.id}>
              {f.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Operator</InputLabel>
        <Select
          label="Operator"
          value={value.operator}
          onChange={(e) => onChange({ ...value, operator: e.target.value as RuleOperator })}
        >
          {operators.map((op) => (
            <MenuItem key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {operatorNeedsValue(value.operator) && (
        <FieldValueInput
          fieldId={value.field}
          multiple={operatorIsMultiValue(value.operator)}
          value={value.value}
          onChange={(v) => onChange({ ...value, value: v })}
        />
      )}
    </Box>
  );
}

// The condition-kind picker (all claims / claim property / group). Maps a choice to a fresh node of
// that kind so callers never have to construct one.
export function ConditionTypeSelect({
  value,
  onChange,
}: {
  value: RuleCondition;
  onChange: (next: RuleCondition) => void;
}): ReactElement {
  return (
    <FormControl size="small" sx={{ minWidth: 160 }}>
      <InputLabel>Condition</InputLabel>
      <Select
        label="Condition"
        value={value.type}
        onChange={(e) => {
          const next = e.target.value as RuleCondition['type'];
          if (next === 'all') onChange({ type: 'all' });
          else if (next === 'field') onChange(newFieldCondition());
          else onChange({ type: 'group', logic: 'and', conditions: [newFieldCondition()] });
        }}
      >
        <MenuItem value="all">All claims</MenuItem>
        <MenuItem value="field">Claim property</MenuItem>
        <MenuItem value="group">Group (AND / OR)</MenuItem>
      </Select>
    </FormControl>
  );
}

// The AND / OR selector for a group condition.
export function LogicSelect({
  value,
  onChange,
}: {
  value: 'and' | 'or';
  onChange: (next: 'and' | 'or') => void;
}): ReactElement {
  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <InputLabel>Match</InputLabel>
      <Select label="Match" value={value} onChange={(e) => onChange(e.target.value as 'and' | 'or')}>
        <MenuItem value="and">All (AND)</MenuItem>
        <MenuItem value="or">Any (OR)</MenuItem>
      </Select>
    </FormControl>
  );
}

// All inputs for a single action (the kind picker plus the kind-specific fields).
export function ActionFields({
  value,
  onChange,
}: {
  value: RuleAction;
  onChange: (next: RuleAction) => void;
}): ReactElement {
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Action</InputLabel>
        <Select
          label="Action"
          value={value.type}
          onChange={(e) => {
            const next = e.target.value as RuleAction['type'];
            if (next === 'setField') onChange(newAction());
            else if (next === 'applyTag') onChange({ type: 'applyTag', tag: '' });
            else onChange({ type: 'noop' });
          }}
        >
          <MenuItem value="setField">Set a property</MenuItem>
          <MenuItem value="applyTag">Apply a tag</MenuItem>
          <MenuItem value="noop">Do nothing</MenuItem>
        </Select>
      </FormControl>
      {value.type === 'setField' && (
        <>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Property</InputLabel>
            <Select
              label="Property"
              value={value.field}
              onChange={(e) => onChange({ ...value, field: e.target.value, value: '' })}
            >
              {SETTABLE_FIELDS.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FieldValueInput
            fieldId={value.field}
            multiple={false}
            value={value.value}
            onChange={(v) => onChange({ ...value, value: typeof v === 'string' ? v : v[0] ?? '' })}
            label="New value"
          />
        </>
      )}
      {value.type === 'applyTag' && (
        <TextField
          size="small"
          label="Tag name"
          value={value.tag}
          onChange={(e) => onChange({ ...value, tag: e.target.value })}
          helperText={`Applying the "${HOLD_TAG_NAME}" tag holds the claim and stops the engine.`}
          sx={{ minWidth: 240 }}
        />
      )}
    </Box>
  );
}

// The outcome-kind picker (take actions / branch further / do nothing).
export function OutcomeTypeSelect({
  value,
  onChange,
}: {
  value: RuleOutcome;
  onChange: (next: RuleOutcome) => void;
}): ReactElement {
  return (
    <FormControl size="small" sx={{ minWidth: 160 }}>
      <InputLabel>Then</InputLabel>
      <Select
        label="Then"
        value={value.type}
        onChange={(e) => {
          const next = e.target.value as RuleOutcome['type'];
          if (next === 'actions') onChange(newOutcome());
          else if (next === 'conditional') onChange({ type: 'conditional', conditional: newRuleConditional() });
          else onChange({ type: 'noop' });
        }}
      >
        <MenuItem value="actions">Take action(s)</MenuItem>
        <MenuItem value="conditional">Branch further (if / else)</MenuItem>
        <MenuItem value="noop">Do nothing</MenuItem>
      </Select>
    </FormControl>
  );
}
