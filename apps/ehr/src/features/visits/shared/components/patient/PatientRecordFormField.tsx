import { Autocomplete, Checkbox, FormControlLabel, Link, TextField, useTheme } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { QuestionnaireItemAnswerOption, Reference } from 'fhir/r4b';
import { FC, useEffect, useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { BasicDatePicker, FormGroupPharmacyCollection, FormSelect, FormTextField } from 'src/components/form';
import { Row } from 'src/components/layout';
import { useApiClients } from 'src/hooks/useAppClients';
import { InputMask } from 'ui-components';
import {
  AnswerOptionSource,
  dedupeObjectsByKey,
  evaluateFieldTriggers,
  FormFieldsDisplayItem,
  FormFieldsGroupItem,
  FormFieldsInputItem,
  isRemovableField,
  PATIENT_RECORD_CONFIG,
  QuestionnaireItemGroupType,
} from 'utils';

// Flat map of linkId → field config, built once at module load for source-field lookup.
const allFieldConfigs = new Map<string, FormFieldsInputItem>();
for (const section of Object.values(PATIENT_RECORD_CONFIG.FormFields)) {
  const items = (section as any).items;
  if (!items) continue;
  const itemValues = Array.isArray(items) ? items.flatMap((group: any) => Object.values(group)) : Object.values(items);
  for (const field of itemValues as FormFieldsInputItem[]) {
    if (field?.key) allFieldConfigs.set(field.key, field);
  }
}

interface PatientRecordFormFieldProps {
  // undefined when a project's config omits a field a shared container references
  item: FormFieldsInputItem | FormFieldsDisplayItem | FormFieldsGroupItem | undefined;
  isLoading: boolean;
  hiddenFormFields?: string[];
  requiredFormFields?: string[];
  omitRowWrapper?: boolean;
  disabled?: boolean;
}

type PatientRecordFormFieldContentProps = Omit<PatientRecordFormFieldProps, 'item'> & {
  item: NonNullable<PatientRecordFormFieldProps['item']>;
};

const PatientRecordFormField: FC<PatientRecordFormFieldProps> = (props) => {
  // Guard against configs that omit a referenced field (e.g. `noEmail`).
  if (!props.item) {
    return null;
  }
  const isHidden = props.hiddenFormFields?.includes(props.item.key);
  if (isHidden) {
    return null;
  }
  return <PatientRecordFormFieldContent {...props} item={props.item} />;
};

const PatientRecordFormFieldContent: FC<PatientRecordFormFieldContentProps> = ({
  item,
  requiredFormFields,
  isLoading,
  omitRowWrapper = false,
  disabled = false,
}) => {
  const { control, watch, setValue, getValues } = useFormContext();
  const theme = useTheme();

  const { enableBehavior = 'any', disabledDisplay } = item;

  let dynamicPopulation: FormFieldsInputItem['dynamicPopulation'];
  if (item.type !== 'display' && item.type !== 'group') {
    dynamicPopulation = item.dynamicPopulation;
  }

  // Get current form values for trigger evaluation
  const formValues = watch();

  // Evaluate triggers using the utility function
  const triggeredEffects = evaluateFieldTriggers(item, formValues, enableBehavior);

  const isDisabled = disabled || triggeredEffects.enabled === false;
  const isRequired = requiredFormFields?.includes(item.key) || triggeredEffects.required;

  if (triggeredEffects.substituteText) {
    if (item.type === 'display' || item.type === 'group') {
      item.text = triggeredEffects.substituteText;
    } else {
      item.label = triggeredEffects.substituteText;
    }
  }

  // Dynamic population: when field is disabled, copy value from source field
  const rawSourceFieldValue = dynamicPopulation?.sourceLinkId ? watch(dynamicPopulation.sourceLinkId) : undefined;
  const stashedValueRef = useRef<any>(null);

  const triggerState = dynamicPopulation?.triggerState ?? 'disabled';

  // Determine whether the source field is currently hidden (disabled + disabledDisplay:'hidden').
  // When it is, treat its effective value as empty so downstream fields don't pick up stale data.
  const sourceFieldConfig = dynamicPopulation?.sourceLinkId
    ? allFieldConfigs.get(dynamicPopulation.sourceLinkId)
    : undefined;
  const sourceEffects = sourceFieldConfig
    ? evaluateFieldTriggers(sourceFieldConfig, formValues, sourceFieldConfig.enableBehavior)
    : null;
  const sourceIsHidden = sourceEffects?.enabled === false && sourceFieldConfig?.disabledDisplay === 'hidden';
  const sourceEmptyValue = sourceFieldConfig?.type === 'boolean' ? false : '';
  const sourceFieldValue = sourceIsHidden ? sourceEmptyValue : rawSourceFieldValue;

  useEffect(() => {
    if (dynamicPopulation && triggerState === 'disabled' && isDisabled) {
      const currentValue = getValues(item.key);

      // Only update if the source value is different from current value
      if (sourceFieldValue !== undefined && sourceFieldValue !== currentValue) {
        // When the source field is hidden/cleared, clear the stash too so re-enabling
        // this field doesn't restore a stale value from before the source was cleared.
        stashedValueRef.current = sourceIsHidden ? null : currentValue;
        // shouldDirty:false — this field mirrors the source as derived state; the
        // trigger field the user actually toggles carries the dirty signal.
        setValue(item.key, sourceFieldValue, { shouldDirty: false });
      }
    } else if (dynamicPopulation && triggerState === 'disabled' && !isDisabled) {
      if (stashedValueRef.current !== null) {
        setValue(item.key, stashedValueRef.current, { shouldDirty: false });
        stashedValueRef.current = null;
      }
    }
  }, [sourceFieldValue, isDisabled, dynamicPopulation, triggerState, item.key, setValue, getValues, sourceIsHidden]);

  if (isDisabled && disabledDisplay === 'hidden') {
    return null;
  }

  let placeholder: string | undefined;
  let mask: string | undefined;
  // ZIP stores the unmasked digits (matching what the backend persists and
  // returns), so IMaskInput's mount-time normalization round-trips cleanly
  // and doesn't mark the field dirty against its loaded default. Phone and
  // SSN store the masked, dashed form they always have.
  let unmask: boolean | undefined;
  if (item.type !== 'display' && item.type !== 'group' && item.dataType === 'Phone Number') {
    placeholder = '(XXX) XXX-XXXX';
    mask = '(000) 000-0000';
  }
  if (item.type !== 'display' && item.type !== 'group' && item.dataType === 'SSN') {
    placeholder = 'XXX-XX-XXXX';
    mask = '000-00-0000';
  }
  if (item.type !== 'display' && item.type !== 'group' && item.dataType === 'ZIP') {
    placeholder = 'XXXXX(-XXXX)';
    mask = '00000-0000'; // will still accept the 5 digit zip
    unmask = true;
  }

  const InputElement = (() => {
    const defaultField = (): JSX.Element => (
      <FormTextField
        name={item.key}
        control={control}
        disabled={isDisabled || isLoading}
        id={omitRowWrapper ? item.key : undefined}
        key={item.key}
        inputProps={{ mask, placeholder, unmask }}
        InputProps={mask ? { inputComponent: InputMask as any } : undefined}
      />
    );

    switch (item.type) {
      case 'choice':
      case 'reference':
        if (item.type === 'reference' && item.dataSource) {
          return (
            <DynamicReferenceField
              item={item}
              id={omitRowWrapper ? item.key : undefined}
              optionStrategy={
                item.dataSource.valueSet
                  ? {
                      type: 'valueSet',
                      valueSet: item.dataSource.valueSet!,
                    }
                  : {
                      type: 'answerSource',
                      answerSource: {
                        ...item.dataSource.answerSource!,
                      },
                    }
              }
            />
          );
        }
        if (item.options?.length && item.options.length > 10) {
          return (
            <Controller
              name={item.key}
              control={control}
              render={({ field, fieldState: { error } }) => {
                const emptyOption = { label: '', value: '' };
                const selectedOption = item.options?.find((option) => option.value === field.value) ?? emptyOption;
                const optionsWithEmpty = [emptyOption, ...(item.options ?? [])];
                return (
                  <Autocomplete
                    {...field}
                    options={optionsWithEmpty}
                    id={omitRowWrapper ? item.key : undefined}
                    value={selectedOption}
                    getOptionLabel={(option) => option?.label || ''}
                    isOptionEqualToValue={(option, value) => {
                      return option.value === value.value;
                    }}
                    onChange={(_, newValue) => {
                      if (newValue && newValue.value) {
                        setValue(item.key, newValue.value, { shouldDirty: true });
                      } else {
                        setValue(item.key, '', { shouldDirty: true });
                      }
                    }}
                    disableClearable
                    fullWidth
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        name={item.key}
                        variant="standard"
                        error={!!error}
                        helperText={error?.message}
                        disabled={isDisabled || isLoading}
                      />
                    )}
                  />
                );
              }}
            />
          );
        }
        return (
          <FormSelect
            name={item.key}
            id={omitRowWrapper ? item.key : undefined}
            control={control}
            disabled={isDisabled || isLoading}
            options={item.options || []}
          />
        );
      case 'date':
        return (
          <BasicDatePicker
            id={omitRowWrapper ? item.key : undefined}
            name={item.key}
            control={control}
            disabled={isDisabled || isLoading}
            component="Field"
          />
        );
      case 'boolean':
        if (item.element === 'Link') {
          return (
            <Controller
              name={item.key}
              control={control}
              render={({ field: { value, onChange } }) => {
                return (
                  <Link
                    component="button"
                    type="button"
                    onClick={() => onChange(!value)}
                    aria-label={item.key}
                    underline="hover"
                    sx={{
                      pt: 1,
                      textAlign: 'left',
                      display: 'inline',
                      cursor: 'pointer',
                      color: theme.palette.primary.main,
                      fontWeight: 500,
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    {item.label}
                  </Link>
                );
              }}
            />
          );
        }
        return (
          <Controller
            name={item.key}
            control={control}
            render={({ field: { value, ...field } }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    {...field}
                    checked={item.key === 'pcp-active' ? !(value ?? false) : (value ?? false)} // this is incredibly silly but needed to invert the logic for this one field. todo...
                    onChange={(e) => field.onChange(item.key === 'pcp-active' ? !e.target.checked : e.target.checked)}
                    disabled={isDisabled || isLoading}
                  />
                }
                label={item.label}
              />
            )}
          />
        );
      case 'group':
        if (item.groupType === QuestionnaireItemGroupType.PharmacyCollection) {
          return <FormGroupPharmacyCollection />;
        }
        return defaultField();
      default:
        return defaultField();
    }
  })();

  if (omitRowWrapper) {
    return InputElement;
  }

  if (item.type === 'display') {
    return <></>; // no use of display type fields in this context for now
  }

  const rowLabel = (() => {
    switch (item.type) {
      case 'group':
        return item.text ?? '';
      case 'boolean':
        return '';
      default:
        return item.label ?? '';
    }
  })();

  return (
    <Row label={rowLabel} inputId={item.key} required={isRequired}>
      {InputElement}
    </Row>
  );
};

type ValueSetStrategy = {
  type: 'valueSet';
  valueSet: string;
};

// todo: these types already exist somewhere
type AnswerSourceStrategy = {
  type: 'answerSource';
  answerSource: AnswerOptionSource;
};

interface DynamicReferenceFieldProps {
  item: Omit<FormFieldsInputItem | FormFieldsDisplayItem, 'options'>;
  optionStrategy: ValueSetStrategy | AnswerSourceStrategy;
  id?: string;
}

/**
 * If the currently selected value is not in the active options list, include it with a
 * "(historical)" suffix so it remains visible. These are typically old organization-based
 * references that are no longer returned by the active options query; the display stored on the
 * saved reference is used as-is.
 */
function ensureSelectedOptionVisible(options: Reference[], selected: Reference | null | undefined): Reference[] {
  if (!selected?.reference) return options;
  const isInList = options.some((opt) => opt.reference === selected.reference);
  if (isInList) return options;
  return [...options, { ...selected, display: `${selected.display || selected.reference} (historical)` }];
}

const DynamicReferenceField: FC<DynamicReferenceFieldProps> = ({ item, optionStrategy, id }) => {
  const { oystehrZambda } = useApiClients();
  const { control, setValue } = useFormContext();
  const optionsInput = (() => {
    const base = { id: 'get-answer-options' };
    if (optionStrategy.type === 'valueSet') {
      return {
        ...base,
        valueSet: optionStrategy.valueSet,
      };
    }
    return {
      ...base,
      id: optionStrategy.answerSource.zambdaId,
      answerSource: optionStrategy.answerSource,
    };
  })();

  const {
    data: answerOptions,
    isLoading,
    isRefetching,
  } = useQuery({
    queryKey: [JSON.stringify(optionsInput)],

    queryFn: async () => {
      if (!oystehrZambda) {
        throw new Error('API client not available');
      }
      return await oystehrZambda?.zambda
        .execute({
          ...optionsInput,
        })
        .then((res) => {
          const output = (res.output as Partial<QuestionnaireItemAnswerOption>[]).map((option) => {
            return {
              ...option.valueReference,
            };
          }) as Reference[];
          return dedupeObjectsByKey(output, 'display');
        });
    },

    enabled: !!oystehrZambda,
  });
  // console.log('Insurance options from query:', insuranceOptions);

  return (
    <Controller
      name={item.key}
      control={control}
      render={({ field: { value }, fieldState: { error } }) => {
        const options = ensureSelectedOptionVisible(answerOptions ?? [], value);

        const selectedOption = value?.reference
          ? options.find((option) => option.reference === value.reference)
          : undefined;
        return (
          <Autocomplete
            options={options}
            loading={isLoading || isRefetching}
            id={id}
            loadingText={'Loading...'}
            value={selectedOption ?? ({ display: '', reference: '' } as Reference)}
            isOptionEqualToValue={(option, value) => {
              // Empty placeholder object check
              if (!value?.reference || !option?.reference) return false;
              return option.reference === value.reference;
            }}
            getOptionLabel={(option) => (option?.display ? option.display : '')}
            onChange={(_, newValue) => {
              if (newValue && newValue.reference) {
                setValue(item.key, { ...newValue }, { shouldDirty: true });
              } else {
                setValue(item.key, null, { shouldDirty: true });
              }
            }}
            disableClearable={!isRemovableField(item.key)}
            fullWidth
            renderInput={(params) => (
              <TextField {...params} variant="standard" error={!!error} helperText={error?.message} />
            )}
          />
        );
      }}
    />
  );
};

export default PatientRecordFormField;
