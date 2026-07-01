import { Add as AddIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
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
import { otherColors } from '../../themes/ottehr/colors';
import { PayerSelect } from './PayerSelect';

// ---------------------------------------------------------------------------
// Recursive editor for a rule's if / else-if / else conditional tree. Each editor is fully
// controlled (value + onChange) and produces an immutably-updated copy on change. Components are
// declared (hoisted) so the mutual recursion (Conditional -> Outcome -> Conditional, Condition ->
// group -> Condition) resolves cleanly.
// ---------------------------------------------------------------------------

const SETTABLE_FIELDS = RULE_FIELD_CATALOG.filter((f) => f.settable);
const FIRST_FIELD_ID = RULE_FIELD_CATALOG[0].id;
const FIRST_SETTABLE_ID = SETTABLE_FIELDS[0].id;

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  eq: 'equals',
  neq: 'does not equal',
  in: 'is one of',
  notIn: 'is not one of',
  contains: 'contains',
  notContains: 'does not contain',
  exists: 'is present',
  notExists: 'is empty',
};

const operatorNeedsValue = (op: RuleOperator): boolean => op !== 'exists' && op !== 'notExists';
const operatorIsMultiValue = (op: RuleOperator): boolean => op === 'in' || op === 'notIn';

const valueToText = (value: string | string[] | null | undefined): string =>
  Array.isArray(value) ? value.join(', ') : value ?? '';

const textToList = (text: string): string[] =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const newFieldCondition = (): RuleCondition => ({ type: 'field', field: FIRST_FIELD_ID, operator: 'eq', value: '' });
const newAction = (): RuleAction => ({ type: 'setField', field: FIRST_SETTABLE_ID, value: '' });
const newOutcome = (): RuleOutcome => ({ type: 'actions', actions: [newAction()] });
const newBranch = (): RuleConditional['branches'][number] => ({
  condition: newFieldCondition(),
  outcome: newOutcome(),
});
export const newRuleConditional = (): RuleConditional => ({ branches: [newBranch()] });

const indentSx = { borderLeft: `2px solid ${otherColors.lightDivider}`, pl: 2, ml: 0.5 };

// Field-aware value input, dispatched on the catalog's valueType so new typed fields (gender
// dropdowns, date pickers, more payer-like fields) only need a catalog entry plus a branch here.
function FieldValueInput({
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
  if (getRuleFieldDef(fieldId)?.valueType === 'payer') {
    return <PayerSelect multiple={multiple} value={value} onChange={onChange} label={label} />;
  }
  return (
    <TextField
      size="small"
      label={label ?? (multiple ? 'Values (comma-separated)' : 'Value')}
      value={valueToText(value)}
      onChange={(e) => onChange(multiple ? textToList(e.target.value) : e.target.value)}
      sx={{ minWidth: 200 }}
    />
  );
}

// --- Condition ---

function ConditionEditor({
  value,
  onChange,
}: {
  value: RuleCondition;
  onChange: (next: RuleCondition) => void;
}): ReactElement {
  return (
    <Box>
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
      {value.type === 'field' && <FieldConditionEditor value={value} onChange={onChange} />}
      {value.type === 'group' && <GroupConditionEditor value={value} onChange={onChange} />}
    </Box>
  );
}

function FieldConditionEditor({
  value,
  onChange,
}: {
  value: Extract<RuleCondition, { type: 'field' }>;
  onChange: (next: RuleCondition) => void;
}): ReactElement {
  const def = getRuleFieldDef(value.field);
  const operators = def?.operators ?? [...RULE_OPERATORS];
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 1 }}>
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

function GroupConditionEditor({
  value,
  onChange,
}: {
  value: Extract<RuleCondition, { type: 'group' }>;
  onChange: (next: RuleCondition) => void;
}): ReactElement {
  const setConditionAt = (index: number, next: RuleCondition): void =>
    onChange({ ...value, conditions: value.conditions.map((c, i) => (i === index ? next : c)) });
  const removeAt = (index: number): void =>
    onChange({ ...value, conditions: value.conditions.filter((_, i) => i !== index) });
  return (
    <Box sx={{ mt: 1, ...indentSx }}>
      <FormControl size="small" sx={{ minWidth: 120, mb: 1 }}>
        <InputLabel>Match</InputLabel>
        <Select
          label="Match"
          value={value.logic}
          onChange={(e) => onChange({ ...value, logic: e.target.value as 'and' | 'or' })}
        >
          <MenuItem value="and">All (AND)</MenuItem>
          <MenuItem value="or">Any (OR)</MenuItem>
        </Select>
      </FormControl>
      {value.conditions.map((condition, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <ConditionEditor value={condition} onChange={(next) => setConditionAt(index, next)} />
          </Box>
          <IconButton size="small" onClick={() => removeAt(index)} disabled={value.conditions.length <= 1}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onChange({ ...value, conditions: [...value.conditions, newFieldCondition()] })}
      >
        Add condition
      </Button>
    </Box>
  );
}

// --- Action ---

function ActionEditor({ value, onChange }: { value: RuleAction; onChange: (next: RuleAction) => void }): ReactElement {
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

// --- Outcome ---

function OutcomeEditor({
  value,
  onChange,
}: {
  value: RuleOutcome;
  onChange: (next: RuleOutcome) => void;
}): ReactElement {
  const actions = value.type === 'actions' ? value.actions : [];
  return (
    <Box>
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
      {value.type === 'actions' && (
        <Box sx={{ mt: 1, ...indentSx }}>
          {actions.map((action, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <ActionEditor
                  value={action}
                  onChange={(next) =>
                    onChange({ type: 'actions', actions: actions.map((a, i) => (i === index ? next : a)) })
                  }
                />
              </Box>
              <IconButton
                size="small"
                onClick={() => onChange({ type: 'actions', actions: actions.filter((_, i) => i !== index) })}
                disabled={actions.length <= 1}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => onChange({ type: 'actions', actions: [...actions, newAction()] })}
          >
            Add action
          </Button>
        </Box>
      )}
      {value.type === 'conditional' && (
        <Box sx={{ mt: 1, ...indentSx }}>
          <ConditionalEditor
            value={value.conditional}
            onChange={(next) => onChange({ type: 'conditional', conditional: next })}
          />
        </Box>
      )}
    </Box>
  );
}

// --- Conditional (top-level entry point) ---

export function ConditionalEditor({
  value,
  onChange,
}: {
  value: RuleConditional;
  onChange: (next: RuleConditional) => void;
}): ReactElement {
  const setBranchAt = (index: number, next: RuleConditional['branches'][number]): void =>
    onChange({ ...value, branches: value.branches.map((b, i) => (i === index ? next : b)) });

  return (
    <Box>
      {value.branches.map((branch, index) => (
        <Box
          key={index}
          sx={{
            border: `1px solid ${otherColors.lightDivider}`,
            borderRadius: 2,
            p: 2,
            mb: 1.5,
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" color="primary.dark" fontWeight={600}>
              {index === 0 ? 'IF' : 'ELSE IF'}
            </Typography>
            <IconButton
              size="small"
              onClick={() => onChange({ ...value, branches: value.branches.filter((_, i) => i !== index) })}
              disabled={value.branches.length <= 1}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          <ConditionEditor
            value={branch.condition}
            onChange={(condition) => setBranchAt(index, { ...branch, condition })}
          />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1.5, mb: 0.5 }}>
            THEN
          </Typography>
          <OutcomeEditor value={branch.outcome} onChange={(outcome) => setBranchAt(index, { ...branch, outcome })} />
        </Box>
      ))}

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onChange({ ...value, branches: [...value.branches, newBranch()] })}
        sx={{ mb: 1 }}
      >
        Add else-if branch
      </Button>

      <Box sx={{ mt: 1 }}>
        {value.otherwise === undefined ? (
          <Button size="small" startIcon={<AddIcon />} onClick={() => onChange({ ...value, otherwise: newOutcome() })}>
            Add ELSE
          </Button>
        ) : (
          <Box
            sx={{
              border: `1px dashed ${otherColors.lightDivider}`,
              borderRadius: 2,
              p: 2,
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" color="primary.dark" fontWeight={600}>
                ELSE
              </Typography>
              <IconButton size="small" onClick={() => onChange({ ...value, otherwise: undefined })}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            <OutcomeEditor value={value.otherwise} onChange={(otherwise) => onChange({ ...value, otherwise })} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
