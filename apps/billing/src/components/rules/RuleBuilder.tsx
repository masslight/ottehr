import { Add as AddIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import {
  getRuleFieldDef,
  HOLD_TAG_NAME,
  operatorIsMultiValue,
  operatorNeedsValue,
  RULE_ACTION_TYPE,
  RULE_CONDITION_TYPE,
  RULE_FIELD_CATALOG,
  RULE_FIELD_GROUP_LABELS,
  RULE_LOGIC,
  RULE_OPERATOR_METADATA,
  RULE_OPERATORS,
  RULE_OUTCOME_TYPE,
  RuleAction,
  RuleCondition,
  RuleConditional,
  RuleFieldDef,
  RuleLogic,
  RuleOperator,
  RuleOutcome,
} from 'utils';
import { otherColors } from '../../themes/ottehr/colors';
import { PayerSelect } from '../PayerSelect';

// ---------------------------------------------------------------------------
// Recursive editor for a rule's if / else-if / else conditional tree, wired to react-hook-form by
// field path (`name`) — it must render inside a FormProvider whose values contain the conditional
// at that path. Each editor reads its node with useWatch and writes structural edits (add/remove a
// branch, switch a condition/outcome/action type) back as an immutably-updated node via setValue.
// Leaf inputs the save schema constrains (a tag name) register through Controller with validation
// rules, so submitting an invalid rule highlights the exact field and focuses it instead of
// round-tripping to the server.
// ---------------------------------------------------------------------------

const SETTABLE_FIELDS = RULE_FIELD_CATALOG.filter((f) => f.settable);
const FIRST_FIELD_ID = RULE_FIELD_CATALOG[0].id;
const FIRST_SETTABLE_ID = SETTABLE_FIELDS[0].id;

// Operator labels come from the shared metadata (also used by the generated docs); dates read as
// before/after instead of less/greater.
const operatorLabel = (op: RuleOperator, def: RuleFieldDef | undefined): string => {
  const metadata = RULE_OPERATOR_METADATA[op];
  return def?.valueType === 'date' && metadata.dateLabel ? metadata.dateLabel : metadata.label;
};

const LOGIC_LABELS: Record<RuleLogic, string> = {
  and: 'All (AND)',
  or: 'Any (OR)',
};

// Property menu items with a subheader per field group. The catalog is authored grouped, so a
// group's fields are contiguous; a subheader is emitted whenever the group changes.
function fieldMenuItems(fields: RuleFieldDef[]): ReactElement[] {
  const items: ReactElement[] = [];
  let lastGroup: RuleFieldDef['group'] | undefined;
  for (const field of fields) {
    if (field.group !== lastGroup) {
      items.push(<ListSubheader key={`group-${field.group}`}>{RULE_FIELD_GROUP_LABELS[field.group]}</ListSubheader>);
      lastGroup = field.group;
    }
    items.push(
      <MenuItem key={field.id} value={field.id}>
        {field.label}
      </MenuItem>
    );
  }
  return items;
}

const valueToText = (value: string | string[] | null | undefined): string =>
  Array.isArray(value) ? value.join(', ') : value ?? '';

const textToList = (text: string): string[] =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const newFieldCondition = (): RuleCondition => ({
  type: RULE_CONDITION_TYPE.field,
  field: FIRST_FIELD_ID,
  operator: 'eq',
  value: '',
});
const newAction = (): RuleAction => ({ type: RULE_ACTION_TYPE.setField, field: FIRST_SETTABLE_ID, value: '' });
const newOutcome = (): RuleOutcome => ({ type: RULE_OUTCOME_TYPE.actions, actions: [newAction()] });
const newBranch = (): RuleConditional['branches'][number] => ({
  condition: newFieldCondition(),
  outcome: newOutcome(),
});
export const newRuleConditional = (): RuleConditional => ({ branches: [newBranch()] });

const indentSx = { borderLeft: `2px solid ${otherColors.lightDivider}`, pl: 2, ml: 0.5 };

// The node at `name` plus a setter that replaces it with an immutably-updated copy.
function useNode<T>(name: string): { value: T; replace: (next: T) => void } {
  const { setValue } = useFormContext();
  const value = useWatch({ name }) as T;
  return { value, replace: (next: T) => setValue(name, next, { shouldDirty: true }) };
}

// Field-aware value input, dispatched on the catalog's valueType so new typed fields (dropdowns
// with options, date pickers, numbers, more payer-like fields) only need a catalog entry — and, for
// a genuinely new type, a branch here.
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
  const def = getRuleFieldDef(fieldId);
  if (def?.valueType === 'payer') {
    return <PayerSelect multiple={multiple} value={value} onChange={onChange} label={label} />;
  }
  if (def?.valueType === 'select' && def.options) {
    const resolvedLabel = label ?? (multiple ? 'Values' : 'Value');
    const selected = multiple ? (Array.isArray(value) ? value : value ? [value] : []) : valueToText(value);
    return (
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>{resolvedLabel}</InputLabel>
        <Select
          label={resolvedLabel}
          multiple={multiple}
          value={selected}
          onChange={(e) => onChange(e.target.value as string | string[])}
        >
          {def.options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }
  if ((def?.valueType === 'date' || def?.valueType === 'number') && !multiple) {
    return (
      <TextField
        size="small"
        type={def.valueType}
        label={label ?? 'Value'}
        value={valueToText(value)}
        onChange={(e) => onChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 200 }}
      />
    );
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

function ConditionEditor({ name }: { name: string }): ReactElement | null {
  const { value, replace } = useNode<RuleCondition>(name);
  if (!value) return null;
  return (
    <Box>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Condition</InputLabel>
        <Select
          label="Condition"
          value={value.type}
          onChange={(e) => {
            const next = e.target.value as RuleCondition['type'];
            if (next === RULE_CONDITION_TYPE.all) replace({ type: RULE_CONDITION_TYPE.all });
            else if (next === RULE_CONDITION_TYPE.field) replace(newFieldCondition());
            else replace({ type: RULE_CONDITION_TYPE.group, logic: 'and', conditions: [newFieldCondition()] });
          }}
        >
          <MenuItem value={RULE_CONDITION_TYPE.all}>All claims</MenuItem>
          <MenuItem value={RULE_CONDITION_TYPE.field}>Claim property</MenuItem>
          <MenuItem value={RULE_CONDITION_TYPE.group}>Group (AND / OR)</MenuItem>
        </Select>
      </FormControl>
      {value.type === RULE_CONDITION_TYPE.field && <FieldConditionEditor name={name} />}
      {value.type === RULE_CONDITION_TYPE.group && <GroupConditionEditor name={name} />}
    </Box>
  );
}

function FieldConditionEditor({ name }: { name: string }): ReactElement | null {
  const { value, replace } = useNode<Extract<RuleCondition, { type: typeof RULE_CONDITION_TYPE.field }>>(name);
  if (!value) return null;
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
            replace({ ...value, field, operator, value: '' });
          }}
        >
          {fieldMenuItems(RULE_FIELD_CATALOG)}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Operator</InputLabel>
        <Select
          label="Operator"
          value={value.operator}
          onChange={(e) => replace({ ...value, operator: e.target.value as RuleOperator })}
        >
          {operators.map((op) => (
            <MenuItem key={op} value={op}>
              {operatorLabel(op, def)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {operatorNeedsValue(value.operator) && (
        <FieldValueInput
          fieldId={value.field}
          multiple={operatorIsMultiValue(value.operator)}
          value={value.value}
          onChange={(v) => replace({ ...value, value: v })}
        />
      )}
    </Box>
  );
}

function GroupConditionEditor({ name }: { name: string }): ReactElement | null {
  const { value, replace } = useNode<Extract<RuleCondition, { type: typeof RULE_CONDITION_TYPE.group }>>(name);
  if (!value) return null;
  const removeAt = (index: number): void =>
    replace({ ...value, conditions: value.conditions.filter((_, i) => i !== index) });
  return (
    <Box sx={{ mt: 1, ...indentSx }}>
      <FormControl size="small" sx={{ minWidth: 120, mb: 1 }}>
        <InputLabel>Match</InputLabel>
        <Select
          label="Match"
          value={value.logic}
          onChange={(e) => replace({ ...value, logic: e.target.value as RuleLogic })}
        >
          {RULE_LOGIC.map((logic) => (
            <MenuItem key={logic} value={logic}>
              {LOGIC_LABELS[logic]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {value.conditions.map((_, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <ConditionEditor name={`${name}.conditions.${index}`} />
          </Box>
          <IconButton size="small" onClick={() => removeAt(index)} disabled={value.conditions.length <= 1}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => replace({ ...value, conditions: [...value.conditions, newFieldCondition()] })}
      >
        Add condition
      </Button>
    </Box>
  );
}

// --- Action ---

function ActionEditor({ name }: { name: string }): ReactElement | null {
  const { control } = useFormContext();
  const { value, replace } = useNode<RuleAction>(name);
  if (!value) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Action</InputLabel>
        <Select
          label="Action"
          value={value.type}
          onChange={(e) => {
            const next = e.target.value as RuleAction['type'];
            if (next === RULE_ACTION_TYPE.setField) replace(newAction());
            else if (next === RULE_ACTION_TYPE.applyTag) replace({ type: RULE_ACTION_TYPE.applyTag, tag: '' });
            else replace({ type: RULE_ACTION_TYPE.noop });
          }}
        >
          <MenuItem value={RULE_ACTION_TYPE.setField}>Set a property</MenuItem>
          <MenuItem value={RULE_ACTION_TYPE.applyTag}>Apply a tag</MenuItem>
          <MenuItem value={RULE_ACTION_TYPE.noop}>Do nothing</MenuItem>
        </Select>
      </FormControl>
      {value.type === RULE_ACTION_TYPE.setField && (
        <>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Property</InputLabel>
            <Select
              label="Property"
              value={value.field}
              onChange={(e) => replace({ ...value, field: e.target.value, value: '' })}
            >
              {fieldMenuItems(SETTABLE_FIELDS)}
            </Select>
          </FormControl>
          <FieldValueInput
            fieldId={value.field}
            multiple={false}
            value={value.value}
            onChange={(v) => replace({ ...value, value: typeof v === 'string' ? v : v[0] ?? '' })}
            label="New value"
          />
        </>
      )}
      {value.type === RULE_ACTION_TYPE.applyTag && (
        <Controller
          name={`${name}.tag`}
          control={control}
          rules={{ validate: (tag: string) => (tag ?? '').trim().length > 0 || 'Tag name is required' }}
          render={({ field: { ref, ...field }, fieldState: { error } }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              inputRef={ref}
              size="small"
              label="Tag name"
              error={!!error}
              helperText={error?.message ?? `Applying the "${HOLD_TAG_NAME}" tag holds the claim and stops the engine.`}
              sx={{ minWidth: 240 }}
            />
          )}
        />
      )}
    </Box>
  );
}

// --- Outcome ---

function OutcomeEditor({ name }: { name: string }): ReactElement | null {
  const { value, replace } = useNode<RuleOutcome>(name);
  if (!value) return null;
  const actions = value.type === RULE_OUTCOME_TYPE.actions ? value.actions : [];
  return (
    <Box>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Then</InputLabel>
        <Select
          label="Then"
          value={value.type}
          onChange={(e) => {
            const next = e.target.value as RuleOutcome['type'];
            if (next === RULE_OUTCOME_TYPE.actions) replace(newOutcome());
            else if (next === RULE_OUTCOME_TYPE.conditional)
              replace({ type: RULE_OUTCOME_TYPE.conditional, conditional: newRuleConditional() });
            else replace({ type: RULE_OUTCOME_TYPE.noop });
          }}
        >
          <MenuItem value={RULE_OUTCOME_TYPE.actions}>Take action(s)</MenuItem>
          <MenuItem value={RULE_OUTCOME_TYPE.conditional}>Branch further (if / else)</MenuItem>
          <MenuItem value={RULE_OUTCOME_TYPE.noop}>Do nothing</MenuItem>
        </Select>
      </FormControl>
      {value.type === RULE_OUTCOME_TYPE.actions && (
        <Box sx={{ mt: 1, ...indentSx }}>
          {actions.map((_, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <ActionEditor name={`${name}.actions.${index}`} />
              </Box>
              <IconButton
                size="small"
                onClick={() =>
                  replace({ type: RULE_OUTCOME_TYPE.actions, actions: actions.filter((_, i) => i !== index) })
                }
                disabled={actions.length <= 1}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => replace({ type: RULE_OUTCOME_TYPE.actions, actions: [...actions, newAction()] })}
          >
            Add action
          </Button>
        </Box>
      )}
      {value.type === RULE_OUTCOME_TYPE.conditional && (
        <Box sx={{ mt: 1, ...indentSx }}>
          <ConditionalEditor name={`${name}.conditional`} />
        </Box>
      )}
    </Box>
  );
}

// --- Conditional (top-level entry point) ---

export function ConditionalEditor({ name }: { name: string }): ReactElement | null {
  const { value, replace } = useNode<RuleConditional>(name);
  if (!value) return null;

  return (
    <Box>
      {value.branches.map((_, index) => (
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
              onClick={() => replace({ ...value, branches: value.branches.filter((_, i) => i !== index) })}
              disabled={value.branches.length <= 1}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          <ConditionEditor name={`${name}.branches.${index}.condition`} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1.5, mb: 0.5 }}>
            THEN
          </Typography>
          <OutcomeEditor name={`${name}.branches.${index}.outcome`} />
        </Box>
      ))}

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => replace({ ...value, branches: [...value.branches, newBranch()] })}
        sx={{ mb: 1 }}
      >
        Add else-if branch
      </Button>

      <Box sx={{ mt: 1 }}>
        {value.otherwise === undefined ? (
          <Button size="small" startIcon={<AddIcon />} onClick={() => replace({ ...value, otherwise: newOutcome() })}>
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
              <IconButton size="small" onClick={() => replace({ ...value, otherwise: undefined })}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            <OutcomeEditor name={`${name}.otherwise`} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
