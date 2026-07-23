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
  ADD_SERVICE_LINE_FIELDS,
  addServiceLineFieldProblem,
  getRuleFieldDef,
  getServiceLinePropertyDef,
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
  RuleFieldOption,
  RuleFieldValueType,
  RuleLogic,
  RuleOperator,
  RuleOutcome,
  SERVICE_LINE_MATCH_TYPE,
  SERVICE_LINE_PROPERTY_CATALOG,
  ServiceLineMatch,
  ServiceLineSetOperation,
  ServiceLineValueType,
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
const SETTABLE_LINE_PROPERTIES = SERVICE_LINE_PROPERTY_CATALOG.filter((p) => p.settable);

// Operator labels come from the shared metadata (also used by the generated docs); dates read as
// before/after instead of less/greater.
const operatorLabel = (op: RuleOperator, valueType: RuleFieldValueType | ServiceLineValueType | undefined): string => {
  const metadata = RULE_OPERATOR_METADATA[op];
  return valueType === 'date' && metadata.dateLabel ? metadata.dateLabel : metadata.label;
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
const newServiceLineMatch = (): ServiceLineMatch => ({
  type: SERVICE_LINE_MATCH_TYPE.field,
  property: SERVICE_LINE_PROPERTY_CATALOG[0].id,
  operator: 'eq',
  value: '',
});
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

// Typed value input dispatched on a valueType: dropdowns for options, date/number pickers, and a
// text field (comma-separated when multiple) otherwise. Shared by the claim-field inputs and the
// service-line match/set inputs.
function TypedValueInput({
  valueType,
  options,
  multiple,
  value,
  onChange,
  label,
}: {
  valueType: RuleFieldValueType | ServiceLineValueType | undefined;
  options?: RuleFieldOption[];
  multiple: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
}): ReactElement {
  if (valueType === 'select' && options) {
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
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }
  if ((valueType === 'date' || valueType === 'number') && !multiple) {
    return (
      <TextField
        size="small"
        type={valueType}
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

// Field-aware value input, dispatched on the catalog's valueType so new typed fields (dropdowns
// with options, date pickers, numbers, more payer-like fields) only need a catalog entry — and, for
// a genuinely new type, a branch here or in TypedValueInput.
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
  return (
    <TypedValueInput
      valueType={def?.valueType}
      options={def?.options}
      multiple={multiple}
      value={value}
      onChange={onChange}
      label={label}
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
              {operatorLabel(op, def?.valueType)}
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

// --- Service line match / set (the line-scoped parts of the service-line actions) ---

// Editor for a service-line predicate: all lines, or lines matching one property comparison.
function ServiceLineMatchEditor({ name }: { name: string }): ReactElement | null {
  const { value, replace } = useNode<ServiceLineMatch>(name);
  if (!value) return null;
  const def = value.type === SERVICE_LINE_MATCH_TYPE.field ? getServiceLinePropertyDef(value.property) : undefined;
  const operators = def?.operators ?? [...RULE_OPERATORS];
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Lines to match</InputLabel>
        <Select
          label="Lines to match"
          value={value.type}
          onChange={(e) => {
            const next = e.target.value as ServiceLineMatch['type'];
            replace(
              next === SERVICE_LINE_MATCH_TYPE.all ? { type: SERVICE_LINE_MATCH_TYPE.all } : newServiceLineMatch()
            );
          }}
        >
          <MenuItem value={SERVICE_LINE_MATCH_TYPE.all}>All service lines</MenuItem>
          <MenuItem value={SERVICE_LINE_MATCH_TYPE.field}>Lines matching a property</MenuItem>
        </Select>
      </FormControl>
      {value.type === SERVICE_LINE_MATCH_TYPE.field && (
        <>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Line property</InputLabel>
            <Select
              label="Line property"
              value={value.property}
              onChange={(e) => {
                const property = e.target.value;
                const nextDef = getServiceLinePropertyDef(property);
                const operator =
                  nextDef && !nextDef.operators.includes(value.operator) ? nextDef.operators[0] : value.operator;
                replace({ ...value, property, operator, value: '' });
              }}
            >
              {SERVICE_LINE_PROPERTY_CATALOG.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.label}
                </MenuItem>
              ))}
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
                  {operatorLabel(op, def?.valueType)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {operatorNeedsValue(value.operator) && (
            <TypedValueInput
              valueType={def?.valueType}
              multiple={operatorIsMultiValue(value.operator)}
              value={value.value}
              onChange={(v) => replace({ ...value, value: v })}
            />
          )}
        </>
      )}
    </Box>
  );
}

// Form for the addServiceLine action: one input per field of the new line, driven by
// ADD_SERVICE_LINE_FIELDS. Required fields and value formats validate through react-hook-form (the
// same shared checks save-time validation runs), so submitting an invalid line highlights the exact
// input; blank optional fields fall back to the claim editor's defaults, shown as helper text.
function AddServiceLineEditor({ name }: { name: string }): ReactElement {
  const { control } = useFormContext();
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {ADD_SERVICE_LINE_FIELDS.map((lineField) => (
        <Controller
          key={lineField.id}
          name={`${name}.line.${lineField.id}`}
          control={control}
          rules={{ validate: (value: string | undefined) => addServiceLineFieldProblem(lineField.id, value) ?? true }}
          render={({ field: { ref, ...field }, fieldState: { error } }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              inputRef={ref}
              size="small"
              type={lineField.valueType === 'number' || lineField.valueType === 'date' ? lineField.valueType : 'text'}
              label={lineField.required ? lineField.label : `${lineField.label} (optional)`}
              InputLabelProps={
                lineField.valueType === 'number' || lineField.valueType === 'date' ? { shrink: true } : undefined
              }
              error={!!error}
              helperText={error?.message ?? (lineField.whenBlank ? `Blank: ${lineField.whenBlank}` : undefined)}
              sx={{ minWidth: 200 }}
            />
          )}
        />
      ))}
    </Box>
  );
}

// Editor for an updateServiceLines set clause: which line property to change, how (for list-valued
// properties: replace / add / remove), and the value.
function ServiceLineSetEditor({ name }: { name: string }): ReactElement | null {
  const { value, replace } = useNode<{ property: string; value: string; operation?: ServiceLineSetOperation }>(name);
  if (!value) return null;
  const def = getServiceLinePropertyDef(value.property);
  const isList = def?.valueType === 'list';
  const operation = value.operation ?? 'set';
  const valueLabel = isList
    ? operation === 'add'
      ? 'Modifier to add'
      : operation === 'remove'
      ? 'Modifier to remove'
      : 'Modifiers (comma-separated)'
    : 'New value';
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Set line property</InputLabel>
        <Select
          label="Set line property"
          value={value.property}
          // Reset the value and operation: they're meaningless across a property change.
          onChange={(e) => replace({ property: e.target.value, value: '' })}
        >
          {SETTABLE_LINE_PROPERTIES.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {isList && (
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Operation</InputLabel>
          <Select
            label="Operation"
            value={operation}
            onChange={(e) => replace({ ...value, operation: e.target.value as ServiceLineSetOperation })}
          >
            <MenuItem value="set">Set to</MenuItem>
            <MenuItem value="add">Add</MenuItem>
            <MenuItem value="remove">Remove</MenuItem>
          </Select>
        </FormControl>
      )}
      <TypedValueInput
        valueType={isList ? 'string' : def?.valueType}
        multiple={false}
        value={value.value}
        onChange={(v) => replace({ ...value, value: typeof v === 'string' ? v : v[0] ?? '' })}
        label={valueLabel}
      />
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
            else if (next === RULE_ACTION_TYPE.addServiceLine)
              replace({ type: RULE_ACTION_TYPE.addServiceLine, line: { cptCode: '', charges: '' } });
            else if (next === RULE_ACTION_TYPE.updateServiceLines)
              replace({
                type: RULE_ACTION_TYPE.updateServiceLines,
                match: newServiceLineMatch(),
                set: { property: SETTABLE_LINE_PROPERTIES[0].id, value: '' },
              });
            else if (next === RULE_ACTION_TYPE.removeServiceLines)
              replace({ type: RULE_ACTION_TYPE.removeServiceLines, match: newServiceLineMatch() });
            else replace({ type: RULE_ACTION_TYPE.noop });
          }}
        >
          <MenuItem value={RULE_ACTION_TYPE.setField}>Set a property</MenuItem>
          <MenuItem value={RULE_ACTION_TYPE.applyTag}>Apply a tag</MenuItem>
          <MenuItem value={RULE_ACTION_TYPE.addServiceLine}>Add a service line</MenuItem>
          <MenuItem value={RULE_ACTION_TYPE.updateServiceLines}>Update service lines</MenuItem>
          <MenuItem value={RULE_ACTION_TYPE.removeServiceLines}>Remove service lines</MenuItem>
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
      {value.type === RULE_ACTION_TYPE.addServiceLine && <AddServiceLineEditor name={name} />}
      {value.type === RULE_ACTION_TYPE.updateServiceLines && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ServiceLineMatchEditor name={`${name}.match`} />
          <ServiceLineSetEditor name={`${name}.set`} />
        </Box>
      )}
      {value.type === RULE_ACTION_TYPE.removeServiceLines && <ServiceLineMatchEditor name={`${name}.match`} />}
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
