import { Add as AddIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, ReactNode, Ref } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import {
  ADD_SERVICE_LINE_FIELDS,
  addServiceLineFieldProblem,
  DATE_SOURCE_CATALOG,
  DateSourceSelectValue,
  EXACT_DATE_SOURCE,
  getRuleFieldDef,
  getServiceLinePropertyDef,
  RULE_FIELD_CATALOG,
  RULE_FIELD_GROUP_LABELS,
  RULE_VALUE_FORMATS,
  ruleConditionValueProblem,
  RuleFieldDef,
  RuleFieldOption,
  RuleFieldValueType,
  SERVICE_LINE_PROPERTY_CATALOG,
  serviceLineMatchValueProblem,
  ServiceLinePropertyDef,
  serviceLineSetValueProblem,
  ServiceLineValueType,
  setFieldValueProblem,
} from 'utils/lib/types/data/billing/rules-engine.field-catalog';
import {
  DateValue,
  effectiveDiagnosisMode,
  operatorIsMultiValue,
  operatorIsRegex,
  operatorNeedsValue,
  RULE_ACTION_TYPE,
  RULE_CONDITION_TYPE,
  RULE_LOGIC,
  RULE_OPERATOR_METADATA,
  RULE_OPERATORS,
  RULE_OUTCOME_TYPE,
  RuleAction,
  RuleCondition,
  RuleConditional,
  RuleLogic,
  RuleOperator,
  RuleOutcome,
  SERVICE_LINE_MATCH_TYPE,
  ServiceLineMatch,
  ServiceLineSetOperation,
} from 'utils/lib/types/data/billing/rules-engine.schemas';
import { HOLD_TAG_NAME } from 'utils/lib/types/data/billing/system-tags';
import { otherColors } from '../../themes/ottehr/colors';
import { DateInput } from '../DateInput';
import { FacilitySelect } from '../FacilitySelect';
import { PayerSelect } from '../PayerSelect';
import { ProcedureCodeAutocomplete } from '../ProcedureCodeAutocomplete';
import { ProviderSelect } from '../ProviderSelect';
import { TagSelect } from '../TagSelect';

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

// Validation display + react-hook-form focus-ref props shared by the value inputs, so each can be
// registered through a Controller and show its own field-level error (the applyTag precedent).
// `required` marks the label with an asterisk when save-time validation rejects a blank value —
// it must mirror the shared value-problem checks (values that may be blank on purpose stay unmarked).
interface ValueInputValidationProps {
  required?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

// The non-error helper text for a field with a validated format (e.g. "a valid 10-digit NPI").
const formatHint = (def: Pick<RuleFieldDef, 'format'> | undefined): string | undefined =>
  def?.format && RULE_VALUE_FORMATS[def.format].validate ? RULE_VALUE_FORMATS[def.format].hint : undefined;

const REGEX_HINT = 'Regular expression; anchor with ^ and $ to match the whole value, e.g. ^9938[1-7]$';

// Pattern input for the regex operators: always a free-text field, regardless of the property's
// usual picker (payer search, tag dropdown, CPT autocomplete, option select) — a pattern is not one
// of the enumerated values.
function RegexPatternInput({
  value,
  onChange,
  label,
  required,
  error,
  helperText,
  inputRef,
}: {
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
} & ValueInputValidationProps): ReactElement {
  return (
    <TextField
      size="small"
      label={label ?? 'Pattern'}
      value={valueToText(value)}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      error={error}
      helperText={helperText}
      inputRef={inputRef}
      inputProps={{ style: { fontFamily: 'monospace' } }}
      sx={{ minWidth: 240 }}
    />
  );
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
  required,
  error,
  helperText,
  inputRef,
  allowEmptyOption,
}: {
  valueType: RuleFieldValueType | ServiceLineValueType | undefined;
  options?: RuleFieldOption[];
  multiple: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
  // setField on a clearable select field: offer an explicit empty entry meaning "clear the property".
  allowEmptyOption?: boolean;
} & ValueInputValidationProps): ReactElement {
  if (valueType === 'select' && options) {
    const resolvedLabel = label ?? (multiple ? 'Values' : 'Value');
    const selected = multiple ? (Array.isArray(value) ? value : value ? [value] : []) : valueToText(value);
    return (
      <FormControl size="small" sx={{ minWidth: 200 }} required={required} error={error}>
        <InputLabel>{resolvedLabel}</InputLabel>
        <Select
          label={resolvedLabel}
          multiple={multiple}
          value={selected}
          onChange={(e) => onChange(e.target.value as string | string[])}
          inputRef={inputRef}
        >
          {allowEmptyOption && !multiple && (
            <MenuItem value="">
              <em>— Clear property —</em>
            </MenuItem>
          )}
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {helperText != null && <FormHelperText>{helperText}</FormHelperText>}
      </FormControl>
    );
  }
  if (valueType === 'date' && !multiple) {
    return (
      <DateInput
        label={label ?? 'Value'}
        size="small"
        value={valueToText(value)}
        onChange={(value) => onChange(value)}
        error={error}
        helperText={helperText}
      />
    );
  }
  if (valueType === 'number' && !multiple) {
    return (
      <TextField
        size="small"
        type={valueType}
        label={label ?? 'Value'}
        value={valueToText(value)}
        onChange={(e) => onChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
        required={required}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
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
      required={required}
      error={error}
      helperText={helperText}
      inputRef={inputRef}
      sx={{ minWidth: 200 }}
    />
  );
}

// Field-aware value input, dispatched on the catalog's valueType/format so new typed fields
// (dropdowns with options, date pickers, numbers, tag/CPT/payer pickers) only need a catalog entry —
// and, for a genuinely new type, a branch here or in TypedValueInput.
function FieldValueInput({
  fieldId,
  multiple,
  isRegex,
  value,
  onChange,
  label,
  required,
  error,
  helperText,
  inputRef,
  allowEmptyOption,
}: {
  fieldId: string;
  multiple: boolean;
  // The regex operators take a pattern: a plain text input replaces the field's usual picker.
  isRegex?: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
  allowEmptyOption?: boolean;
} & ValueInputValidationProps): ReactElement {
  const def = getRuleFieldDef(fieldId);
  if (isRegex) {
    return (
      <RegexPatternInput
        value={value}
        onChange={onChange}
        label={label}
        required={required}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
      />
    );
  }
  if (def?.valueType === 'payer') {
    return (
      <PayerSelect
        multiple={multiple}
        value={value}
        onChange={onChange}
        label={label}
        required={required}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
      />
    );
  }
  if (def?.valueType === 'provider') {
    return (
      <ProviderSelect
        providerRole={def.providerRole ?? 'billing'}
        multiple={multiple}
        value={value}
        onChange={onChange}
        label={label ?? 'Provider'}
        required={required}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
      />
    );
  }
  if (def?.valueType === 'facility') {
    return (
      <FacilitySelect
        multiple={multiple}
        value={value}
        onChange={onChange}
        label={label ?? 'Facility'}
        required={required}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
      />
    );
  }
  if (def?.format === 'tag' && !multiple) {
    return (
      <TagSelect
        value={valueToText(value)}
        onChange={onChange}
        label={label ?? 'Tag'}
        required={required}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
      />
    );
  }
  if (def?.format === 'cpt' && !multiple) {
    return (
      <ProcedureCodeAutocomplete
        value={valueToText(value)}
        onChange={onChange}
        label={label ?? 'CPT code'}
        width={200}
        required={required}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
      />
    );
  }
  return (
    <TypedValueInput
      valueType={def?.valueType}
      options={def?.options}
      multiple={multiple}
      value={value}
      onChange={onChange}
      label={label}
      required={required}
      error={error}
      helperText={helperText}
      inputRef={inputRef}
      allowEmptyOption={allowEmptyOption}
    />
  );
}

// Line-property value input: the CPT terminology autocomplete for cpt-format properties, otherwise
// the shared typed input (the place-of-service dropdown arrives via the property's options).
function ServiceLineValueInput({
  def,
  multiple,
  isRegex,
  value,
  onChange,
  label,
  required,
  error,
  helperText,
  inputRef,
  allowEmptyOption,
}: {
  def: ServiceLinePropertyDef | undefined;
  multiple: boolean;
  // The regex operators take a pattern: a plain text input replaces the property's usual picker.
  isRegex?: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
  allowEmptyOption?: boolean;
} & ValueInputValidationProps): ReactElement {
  if (isRegex) {
    return (
      <RegexPatternInput
        value={value}
        onChange={onChange}
        label={label}
        required={required}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
      />
    );
  }
  if (def?.format === 'cpt' && !multiple) {
    return (
      <ProcedureCodeAutocomplete
        value={valueToText(value)}
        onChange={onChange}
        label={label ?? 'CPT code'}
        width={200}
        required={required}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
      />
    );
  }
  return (
    <TypedValueInput
      valueType={def?.valueType === 'list' ? 'string' : def?.valueType}
      options={def?.options}
      multiple={multiple}
      value={value}
      onChange={onChange}
      label={label}
      required={required}
      error={error}
      helperText={helperText}
      inputRef={inputRef}
      allowEmptyOption={allowEmptyOption}
    />
  );
}

// Date-or-derived-source input for the serviceDate fields addServiceLine/updateServiceLines expose.
// Deliberately separate from TypedValueInput/ServiceLineValueInput, which ServiceLineMatchEditor also
// uses for its (literal-only) date comparisons — this selector must not leak into line matching.
// "Exact date" (the default) keeps the plain-string form every rule saved before this option existed
// already uses; picking one of the other two sources swaps the field's value to a tagged object.
function DateOrSourceInput({
  value,
  onChange,
  label,
  error,
  helperText,
  inputRef,
}: {
  value: DateValue | null | undefined;
  onChange: (value: DateValue) => void;
  label?: string;
} & ValueInputValidationProps): ReactElement {
  const source: DateSourceSelectValue = value && typeof value === 'object' ? value.source : EXACT_DATE_SOURCE;
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <FormControl size="small" sx={{ minWidth: 220 }}>
        <InputLabel>{label ? `${label} source` : 'Date source'}</InputLabel>
        <Select
          label={label ? `${label} source` : 'Date source'}
          value={source}
          inputRef={source !== EXACT_DATE_SOURCE ? inputRef : undefined}
          onChange={(e) => {
            const next = e.target.value as DateSourceSelectValue;
            onChange(next === EXACT_DATE_SOURCE ? '' : { source: next });
          }}
        >
          {DATE_SOURCE_CATALOG.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {source !== EXACT_DATE_SOURCE && helperText != null && (
          <FormHelperText error={error}>{helperText}</FormHelperText>
        )}
      </FormControl>
      {source === EXACT_DATE_SOURCE && (
        <DateInput
          label={label ?? 'Date'}
          size="small"
          value={typeof value === 'string' ? value : ''}
          onChange={(value) => onChange(value)}
          error={error}
          helperText={helperText}
        />
      )}
    </Box>
  );
}

// --- Condition ---

function ConditionEditor({ name }: { name: string }): ReactElement | null {
  const { clearErrors } = useFormContext();
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
            // The subtree was rebuilt; any value errors from a previous submit no longer apply.
            clearErrors(name);
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
  const { control, clearErrors } = useFormContext();
  const { value, replace } = useNode<Extract<RuleCondition, { type: typeof RULE_CONDITION_TYPE.field }>>(name);
  if (!value) return null;
  const def = getRuleFieldDef(value.field);
  const operators = def?.operators ?? [...RULE_OPERATORS];
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start', mt: 1 }}>
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
            clearErrors(name);
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
          onChange={(e) => {
            const operator = e.target.value as RuleOperator;
            // The value survives same-shape switches (equals -> does not equal) but resets when the
            // arity changes (a leftover list under a single-value operator would otherwise be
            // silently compared as its first entry) or when regex-ness changes (a literal is not a
            // pattern, and vice versa).
            const sameShape =
              operatorIsMultiValue(operator) === operatorIsMultiValue(value.operator) &&
              operatorIsRegex(operator) === operatorIsRegex(value.operator);
            replace(sameShape ? { ...value, operator } : { ...value, operator, value: '' });
            clearErrors(name);
          }}
        >
          {operators.map((op) => (
            <MenuItem key={op} value={op}>
              {operatorLabel(op, def?.valueType)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {operatorNeedsValue(value.operator) && (
        <Controller
          // Remount on a property/operator switch so the validation rule re-registers for the new field.
          key={`${value.field}|${value.operator}`}
          name={`${name}.value`}
          control={control}
          rules={{
            validate: (v: string | string[] | null | undefined) =>
              def ? ruleConditionValueProblem(def, value.operator, v ?? undefined) ?? true : true,
          }}
          render={({ field: { ref, value: fieldValue, onChange }, fieldState: { error } }) => (
            <FieldValueInput
              fieldId={value.field}
              multiple={operatorIsMultiValue(value.operator)}
              isRegex={operatorIsRegex(value.operator)}
              value={fieldValue}
              onChange={onChange}
              required
              error={!!error}
              helperText={error?.message ?? (operatorIsRegex(value.operator) ? REGEX_HINT : formatHint(def))}
              inputRef={ref}
            />
          )}
        />
      )}
    </Box>
  );
}

function GroupConditionEditor({ name }: { name: string }): ReactElement | null {
  const { clearErrors } = useFormContext();
  const { value, replace } = useNode<Extract<RuleCondition, { type: typeof RULE_CONDITION_TYPE.group }>>(name);
  if (!value) return null;
  const removeAt = (index: number): void => {
    replace({ ...value, conditions: value.conditions.filter((_, i) => i !== index) });
    // Later conditions shift down an index, so any submitted errors now point at the wrong row.
    clearErrors(`${name}.conditions`);
  };
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
  const { control, clearErrors } = useFormContext();
  const { value, replace } = useNode<ServiceLineMatch>(name);
  if (!value) return null;
  const def = value.type === SERVICE_LINE_MATCH_TYPE.field ? getServiceLinePropertyDef(value.property) : undefined;
  const operators = def?.operators ?? [...RULE_OPERATORS];
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
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
            clearErrors(name);
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
                clearErrors(name);
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
              onChange={(e) => {
                const operator = e.target.value as RuleOperator;
                // Same arity/regex-change reset as the condition editor's operator picker.
                const sameShape =
                  operatorIsMultiValue(operator) === operatorIsMultiValue(value.operator) &&
                  operatorIsRegex(operator) === operatorIsRegex(value.operator);
                replace(sameShape ? { ...value, operator } : { ...value, operator, value: '' });
                clearErrors(name);
              }}
            >
              {operators.map((op) => (
                <MenuItem key={op} value={op}>
                  {operatorLabel(op, def?.valueType)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {operatorNeedsValue(value.operator) && (
            <Controller
              key={`${value.property}|${value.operator}`}
              name={`${name}.value`}
              control={control}
              rules={{
                validate: (v: string | string[] | null | undefined) =>
                  def ? serviceLineMatchValueProblem(def, value.operator, v ?? undefined) ?? true : true,
              }}
              render={({ field: { ref, value: fieldValue, onChange }, fieldState: { error } }) => (
                <ServiceLineValueInput
                  def={def}
                  multiple={operatorIsMultiValue(value.operator)}
                  isRegex={operatorIsRegex(value.operator)}
                  value={fieldValue}
                  onChange={onChange}
                  required
                  error={!!error}
                  helperText={error?.message ?? (operatorIsRegex(value.operator) ? REGEX_HINT : formatHint(def))}
                  inputRef={ref}
                />
              )}
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
  // diagnosisPointers only means anything when diagnosisMode is 'specific' — hide it otherwise
  // rather than showing an input that has no effect. A rule saved before diagnosisMode existed has
  // pointers but no mode, so fall back the same way the engine does (effectiveDiagnosisMode) instead
  // of showing an unselected dropdown for a line that's actually pointing at specific diagnoses.
  const diagnosisMode = useWatch({ control, name: `${name}.line.diagnosisMode` });
  const diagnosisPointers = useWatch({ control, name: `${name}.line.diagnosisPointers` });
  const effectiveMode = effectiveDiagnosisMode({ diagnosisMode, diagnosisPointers });
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {ADD_SERVICE_LINE_FIELDS.filter(
        (lineField) => lineField.id !== 'diagnosisPointers' || effectiveMode === 'specific'
      ).map((lineField) => (
        <Controller
          key={lineField.id}
          name={`${name}.line.${lineField.id}`}
          control={control}
          rules={{
            validate: (value: string | DateValue | undefined) =>
              addServiceLineFieldProblem(lineField.id, value, { diagnosisMode }) ?? true,
          }}
          render={({ field: { ref, value: fieldValue, onChange, onBlur }, fieldState: { error } }) => {
            const label = lineField.required ? lineField.label : `${lineField.label} (optional)`;
            const helperText = error?.message ?? (lineField.whenBlank ? `Blank: ${lineField.whenBlank}` : undefined);
            if (lineField.id === 'serviceDate') {
              return (
                <DateOrSourceInput
                  value={fieldValue}
                  onChange={onChange}
                  label={label}
                  required={lineField.required}
                  error={!!error}
                  helperText={helperText}
                  inputRef={ref}
                />
              );
            }
            if (lineField.format === 'cpt') {
              return (
                <ProcedureCodeAutocomplete
                  value={fieldValue ?? ''}
                  onChange={onChange}
                  label={label}
                  width={200}
                  required={lineField.required}
                  error={!!error}
                  helperText={helperText}
                  inputRef={ref}
                />
              );
            }
            if (lineField.options) {
              const options = lineField.options;
              return (
                <Autocomplete
                  size="small"
                  options={options}
                  value={options.find((option) => option.value === fieldValue) ?? null}
                  onChange={(_, option) => onChange(option?.value ?? '')}
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, v) => option.value === v.value}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={label}
                      required={lineField.required}
                      error={!!error}
                      helperText={helperText}
                      inputRef={ref}
                    />
                  )}
                  sx={{ minWidth: 220 }}
                />
              );
            }
            return (
              <TextField
                value={fieldValue ?? ''}
                onChange={onChange}
                onBlur={onBlur}
                inputRef={ref}
                size="small"
                type={lineField.valueType === 'number' || lineField.valueType === 'date' ? lineField.valueType : 'text'}
                label={label}
                InputLabelProps={
                  lineField.valueType === 'number' || lineField.valueType === 'date' ? { shrink: true } : undefined
                }
                required={lineField.required}
                error={!!error}
                helperText={helperText}
                sx={{ minWidth: 200 }}
              />
            );
          }}
        />
      ))}
    </Box>
  );
}

// Editor for an updateServiceLines set clause: which line property to change, how (for list-valued
// properties: replace / add / remove), and the value.
function ServiceLineSetEditor({ name }: { name: string }): ReactElement | null {
  const { control, clearErrors } = useFormContext();
  const { value, replace } = useNode<{ property: string; value: DateValue; operation?: ServiceLineSetOperation }>(name);
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
  const valueRequired = isList ? operation !== 'set' : def?.id !== 'placeOfService';
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Set line property</InputLabel>
        <Select
          label="Set line property"
          value={value.property}
          // Reset the value and operation: they're meaningless across a property change.
          onChange={(e) => {
            replace({ property: e.target.value, value: '' });
            clearErrors(name);
          }}
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
            onChange={(e) => {
              const next = e.target.value as ServiceLineSetOperation;
              // "Set to" takes the whole comma-separated modifier list; add/remove take one code.
              // Reset the value when the shape changes so a stale list isn't applied as one code.
              const sameShape = (next === 'set') === (operation === 'set');
              replace(sameShape ? { ...value, operation: next } : { ...value, operation: next, value: '' });
              clearErrors(name);
            }}
          >
            <MenuItem value="set">Set to</MenuItem>
            <MenuItem value="add">Add</MenuItem>
            <MenuItem value="remove">Remove</MenuItem>
          </Select>
        </FormControl>
      )}
      <Controller
        key={`${value.property}|${operation}`}
        name={`${name}.value`}
        control={control}
        rules={{
          validate: (v: DateValue | null | undefined) =>
            def ? serviceLineSetValueProblem(def, value.operation, v) ?? true : true,
        }}
        render={({ field: { ref, value: fieldValue, onChange }, fieldState: { error } }) =>
          def?.valueType === 'date' ? (
            <DateOrSourceInput
              value={fieldValue}
              onChange={onChange}
              label={valueLabel}
              required={valueRequired}
              error={!!error}
              helperText={error?.message ?? formatHint(def)}
              inputRef={ref}
            />
          ) : (
            <ServiceLineValueInput
              def={def}
              multiple={false}
              value={fieldValue as string | string[] | null | undefined}
              onChange={(v) => onChange(typeof v === 'string' ? v : v[0] ?? '')}
              label={valueLabel}
              required={valueRequired}
              error={!!error}
              helperText={error?.message ?? formatHint(def)}
              inputRef={ref}
              // The only clearable scalar line property; an explicit empty entry means "clear it".
              allowEmptyOption={def?.id === 'placeOfService'}
            />
          )
        }
      />
    </Box>
  );
}

// --- Action ---

function ActionEditor({ name }: { name: string }): ReactElement | null {
  const { control, clearErrors } = useFormContext();
  const { value, replace } = useNode<RuleAction>(name);
  if (!value) return null;
  const setFieldDef = value.type === RULE_ACTION_TYPE.setField ? getRuleFieldDef(value.field) : undefined;
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
              replace({
                type: RULE_ACTION_TYPE.addServiceLine,
                line: { cptCode: '', charges: '', diagnosisMode: 'primary' },
              });
            else if (next === RULE_ACTION_TYPE.updateServiceLines)
              replace({
                type: RULE_ACTION_TYPE.updateServiceLines,
                match: newServiceLineMatch(),
                set: { property: SETTABLE_LINE_PROPERTIES[0].id, value: '' },
              });
            else if (next === RULE_ACTION_TYPE.removeServiceLines)
              replace({ type: RULE_ACTION_TYPE.removeServiceLines, match: newServiceLineMatch() });
            else if (next === RULE_ACTION_TYPE.applyChargeMasterPrices)
              // Default to all lines: re-pricing the whole claim is the common case.
              replace({ type: RULE_ACTION_TYPE.applyChargeMasterPrices, match: { type: SERVICE_LINE_MATCH_TYPE.all } });
            else replace({ type: RULE_ACTION_TYPE.noop });
            clearErrors(name);
          }}
        >
          <MenuItem value={RULE_ACTION_TYPE.setField}>Set a property</MenuItem>
          <MenuItem value={RULE_ACTION_TYPE.applyTag}>Apply a tag</MenuItem>
          <MenuItem value={RULE_ACTION_TYPE.addServiceLine}>Add a service line</MenuItem>
          <MenuItem value={RULE_ACTION_TYPE.updateServiceLines}>Update service lines</MenuItem>
          <MenuItem value={RULE_ACTION_TYPE.removeServiceLines}>Remove service lines</MenuItem>
          <MenuItem value={RULE_ACTION_TYPE.applyChargeMasterPrices}>Apply charge master prices</MenuItem>
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
              onChange={(e) => {
                // Reset the value: it's meaningless across a property change.
                replace({ ...value, field: e.target.value, value: '' });
                clearErrors(name);
              }}
            >
              {fieldMenuItems(SETTABLE_FIELDS)}
            </Select>
          </FormControl>
          <Controller
            key={value.field}
            name={`${name}.value`}
            control={control}
            rules={{
              validate: (v: string | null | undefined) =>
                setFieldDef ? setFieldValueProblem(setFieldDef, v) ?? true : true,
            }}
            render={({ field: { ref, value: fieldValue, onChange }, fieldState: { error } }) => (
              <FieldValueInput
                fieldId={value.field}
                multiple={false}
                value={fieldValue}
                onChange={(v) => onChange(typeof v === 'string' ? v : v[0] ?? '')}
                label="New value"
                required={!!setFieldDef?.requiredOnSet}
                error={!!error}
                helperText={
                  error?.message ??
                  formatHint(setFieldDef) ??
                  // Selects get an explicit "— Clear property —" item instead of a hint.
                  (setFieldDef && !setFieldDef.requiredOnSet && setFieldDef.valueType !== 'select'
                    ? 'Blank clears the property'
                    : undefined)
                }
                inputRef={ref}
                allowEmptyOption={!!setFieldDef && !setFieldDef.requiredOnSet}
              />
            )}
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
      {value.type === RULE_ACTION_TYPE.applyChargeMasterPrices && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <ServiceLineMatchEditor name={`${name}.match`} />
          <FormHelperText>
            Prices each matched line from the best charge master for the claim's billing type (the insurance or self-pay
            default, most recent effective date on or before the date of service). Lines the charge master cannot price
            keep their existing charges — this action never fails or holds the claim.
          </FormHelperText>
        </Box>
      )}
      {value.type === RULE_ACTION_TYPE.applyTag && (
        <Controller
          name={`${name}.tag`}
          control={control}
          rules={{ validate: (tag: string) => (tag ?? '').trim().length > 0 || 'Tag name is required' }}
          render={({ field: { ref, value: fieldValue, onChange }, fieldState: { error } }) => (
            <TagSelect
              value={fieldValue}
              onChange={onChange}
              label="Tag name"
              required
              error={!!error}
              helperText={error?.message ?? `Applying the "${HOLD_TAG_NAME}" tag holds the claim and stops the engine.`}
              inputRef={ref}
            />
          )}
        />
      )}
    </Box>
  );
}

// --- Outcome ---

function OutcomeEditor({ name }: { name: string }): ReactElement | null {
  const { clearErrors } = useFormContext();
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
            clearErrors(name);
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
                onClick={() => {
                  replace({ type: RULE_OUTCOME_TYPE.actions, actions: actions.filter((_, i) => i !== index) });
                  // Later actions shift down an index, so any submitted errors now point at the wrong row.
                  clearErrors(`${name}.actions`);
                }}
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
  const { clearErrors } = useFormContext();
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
              onClick={() => {
                replace({ ...value, branches: value.branches.filter((_, i) => i !== index) });
                // Later branches shift down an index, so any submitted errors now point at the wrong branch.
                clearErrors(`${name}.branches`);
              }}
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
              <IconButton
                size="small"
                onClick={() => {
                  replace({ ...value, otherwise: undefined });
                  clearErrors(`${name}.otherwise`);
                }}
              >
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
