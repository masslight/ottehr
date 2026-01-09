import { Autocomplete, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { QuestionnaireItemAnswerOption, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FC, useEffect, useRef } from 'react';
import { Controller, RegisterOptions, useFormContext } from 'react-hook-form';
import { BasicDatePicker, FormSelect, FormTextField } from 'src/components/form';
import InputMask from 'src/components/InputMask';
import { Row } from 'src/components/layout';
import { useApiClients } from 'src/hooks/useAppClients';
import { dedupeObjectsByKey, FormFieldsItem, FormFieldTrigger, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

interface PatientRecordFormFieldProps {
  item: FormFieldsItem;
  isLoading: boolean;
  hiddenFormFields?: string[];
  requiredFormFields?: string[];
  omitRowWrapper?: boolean;
  disabled?: boolean;
}

interface Trigger extends Omit<FormFieldTrigger, 'effect'> {
  effect: string;
}

const PatientRecordFormField: FC<PatientRecordFormFieldProps> = (props) => {
  const isHidden = props.hiddenFormFields?.includes(props.item.key);
  if (isHidden) {
    return null;
  }
  return <PatientRecordFormFieldContent {...props} />;
};

const PatientRecordFormFieldContent: FC<PatientRecordFormFieldProps> = ({
  item,
  requiredFormFields,
  isLoading,
  omitRowWrapper = false,
  disabled = false,
}) => {
  const { control, watch, setValue, getValues } = useFormContext();

  const { triggers, enableBehavior = 'any', dynamicPopulation, disabledDisplay } = item;

  const triggeredEffects = (() => {
    if (!triggers || triggers.length === 0) {
      return { required: false, enabled: true };
    }
    const flattenedTriggers: Trigger[] = triggers.flatMap((trigger) =>
      trigger.effect.map((ef) => {
        return { ...trigger, effect: ef };
      })
    );
    const triggerQuestions = flattenedTriggers.map((trigger) => trigger.targetQuestionLinkId);
    const triggerValueMap = triggerQuestions.reduce(
      (acc, linkId) => {
        acc[linkId] = watch(linkId);
        return acc;
      },
      {} as Record<string, any>
    );
    const triggerConditionsWithOutcomes: (Trigger & { conditionMet: boolean })[] = flattenedTriggers.map((trigger) => {
      const currentValue = triggerValueMap[trigger.targetQuestionLinkId];
      const { operator, answerBoolean, answerString, answerDateTime } = trigger;
      let conditionMet = false;
      // todo: extract this logic to a shared util function?
      switch (operator) {
        case 'exists':
          if (answerBoolean === true) {
            conditionMet = currentValue !== undefined && currentValue !== null && currentValue !== '';
          } else if (answerBoolean === false) {
            conditionMet = currentValue === undefined || currentValue === null || currentValue === '';
          }
          break;
        case '=':
          if (answerBoolean !== undefined) {
            conditionMet = currentValue === answerBoolean;
          } else if (answerString !== undefined) {
            conditionMet = currentValue === answerString;
          } else if (answerDateTime !== undefined) {
            conditionMet = currentValue === answerDateTime;
          }
          break;
        case '!=':
          if (answerBoolean !== undefined) {
            conditionMet = currentValue !== answerBoolean;
          } else if (answerString !== undefined) {
            conditionMet = currentValue !== answerString;
          } else if (answerDateTime !== undefined) {
            conditionMet = currentValue !== answerDateTime;
          }
          break;
        case '>':
          if (answerDateTime !== undefined) {
            conditionMet = DateTime.fromISO(currentValue) > DateTime.fromISO(answerDateTime);
          }
          break;
        case '<':
          if (answerDateTime !== undefined) {
            conditionMet = DateTime.fromISO(currentValue) < DateTime.fromISO(answerDateTime);
          }
          break;
        case '>=':
          if (answerDateTime !== undefined) {
            conditionMet = DateTime.fromISO(currentValue) >= DateTime.fromISO(answerDateTime);
          }
          break;
        case '<=':
          if (answerDateTime !== undefined) {
            conditionMet = DateTime.fromISO(currentValue) <= DateTime.fromISO(answerDateTime);
          }
          break;
        default:
          console.warn(`Operator ${operator} not implemented in trigger processing`);
      }
      return { ...trigger, conditionMet };
    });
    // console.log('Trigger condition outcomes for', item.key, triggerConditionsWithOutcomes);
    return triggerConditionsWithOutcomes.reduce(
      (acc, trigger) => {
        if (trigger.effect === 'enable' && trigger.conditionMet) {
          if (acc.enabled === null) {
            acc.enabled = true;
          } else if (enableBehavior === 'all') {
            acc.enabled = acc.enabled && true;
          } else {
            acc.enabled = true;
          }
        } else if (trigger.effect === 'enable' && !trigger.conditionMet) {
          if (acc.enabled === null) {
            acc.enabled = false;
          } else if (enableBehavior === 'all') {
            acc.enabled = false;
          } else {
            acc.enabled = acc.enabled || false;
          }
        }
        // only 'enable' effect supports 'all' vs 'any' behavior for now; "any" is default for all other effects
        if (trigger.effect === 'require' && trigger.conditionMet) {
          acc.required = true;
        }
        if (trigger.effect === 'require' && !trigger.conditionMet) {
          acc.required = acc.required || false;
        }

        return acc;
      },
      { required: false, enabled: null as boolean | null }
    );
  })();

  const isDisabled = disabled || isLoading || triggeredEffects.enabled === false;
  const isRequired = requiredFormFields?.includes(item.key) || triggeredEffects.required;

  // Dynamic population: when field is disabled, copy value from source field
  const sourceFieldValue = dynamicPopulation?.sourceLinkId ? watch(dynamicPopulation.sourceLinkId) : undefined;
  const stashedValueRef = useRef<any>(null);

  useEffect(() => {
    if (dynamicPopulation && dynamicPopulation.triggerState === 'disabled' && isDisabled) {
      const currentValue = getValues(item.key);

      // Only update if the source value is different from current value
      if (sourceFieldValue !== undefined && sourceFieldValue !== currentValue) {
        stashedValueRef.current = currentValue;
        setValue(item.key, sourceFieldValue, { shouldDirty: true });
      }
    } else if (dynamicPopulation && dynamicPopulation.triggerState === 'disabled' && !isDisabled) {
      if (stashedValueRef.current !== null) {
        setValue(item.key, stashedValueRef.current, { shouldDirty: true });
        stashedValueRef.current = null;
      }
    }
  }, [sourceFieldValue, isDisabled, dynamicPopulation, item.key, setValue, getValues]);

  if (isDisabled && disabledDisplay === 'hidden') {
    return null;
  }

  const rules = (() => {
    // console.log('otherGroupKeys, adding rules for', item.key);
    const rules: any = {};
    if (isRequired) {
      rules.required = REQUIRED_FIELD_ERROR_MESSAGE;
    }
    if (item.dataType === 'ZIP') {
      rules.pattern = {
        value: /^\d{5}(-\d{4})?$/,
        message: 'Must be 5 digits',
      };
    }
    if (item.dataType === 'DOB') {
      rules.validate = (value: string) => {
        const today = DateTime.now();
        const dob = DateTime.fromISO(value);
        if (!dob.isValid) {
          return 'Please enter a valid date';
        }
        if (dob > today) {
          return 'Date of birth cannot be in the future';
        }
        return true;
      };
    }
    if (item.dataType === 'Phone Number') {
      rules.pattern = {
        value: /^\(\d{3}\) \d{3}-\d{4}$/,
        message: 'Phone number must be 10 digits in the format (xxx) xxx-xxxx',
      };
    }
    if (item.dataType === 'SSN') {
      rules.pattern = {
        value: /^\d{3}-\d{2}-\d{4}$/,
        message: 'Please enter a valid SSN',
      };
    }
    if (item.type === 'date' && item.dataType !== 'DOB') {
      rules.validate = (value: string) => {
        const date = DateTime.fromISO(value);
        if (!date.isValid) {
          return 'Please enter a valid date';
        }
        return true;
      };
    }
    if (item.dataType === 'Email') {
      rules.pattern = {
        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Must be in the format "email@example.com"',
      };
    }
    if (item.key === 'insurance-priority' || item.key === 'insurance-priority-2') {
      rules.validate = (value: string, context: any) => {
        // todo: this validation concept would be good to lift into the paperwork validation engine
        // hardcoding for now
        const otherGroupKey = item.key === 'insurance-priority' ? 'insurance-priority-2' : 'insurance-priority';
        let otherGroupValue: 'Primary' | 'Secondary' | undefined;
        if (otherGroupKey) {
          otherGroupValue = context[otherGroupKey];
        }
        if (otherGroupValue === value) {
          return `Account may not have two ${value.toLowerCase()} insurance plans`;
        }
        return true;
      };
    }
    return rules;
  })();

  let placeholder: string | undefined;
  let mask: string | undefined;
  if (item.dataType === 'Phone Number') {
    placeholder = '(XXX) XXX-XXXX';
    mask = '(000) 000-0000';
  }
  if (item.dataType === 'SSN') {
    placeholder = 'XXX-XX-XXXX';
    mask = '000-00-0000';
  }

  const InputElement = (() => {
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
              rules={rules}
            />
          );
        }
        if (item.options?.length && item.options.length > 10) {
          return (
            <Controller
              name={item.key}
              control={control}
              rules={rules}
              render={({ field, fieldState: { error } }) => {
                const selectedOption = item.options?.find((option) => option.value === field.value) ?? {
                  label: '',
                  value: '',
                };
                return (
                  <Autocomplete
                    {...field}
                    options={item.options ?? []}
                    id={omitRowWrapper ? item.key : undefined}
                    value={selectedOption}
                    onChange={(_, newValue) => {
                      if (newValue) {
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
                        disabled={isDisabled}
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
            disabled={isDisabled}
            options={item.options || []}
            rules={rules}
          />
        );
      case 'date':
        return (
          <BasicDatePicker
            id={omitRowWrapper ? item.key : undefined}
            name={item.key}
            control={control}
            disabled={isDisabled}
            rules={rules}
            component="Field"
          />
        );
      case 'boolean':
        return (
          <Controller
            name={item.key}
            control={control}
            render={({ field: { value, ...field } }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    {...field}
                    checked={item.key === 'pcp-active' ? !(value ?? false) : value ?? false} // this is incredibly silly but needed to invert the logic for this one field. todo...
                    onChange={(e) => field.onChange(item.key === 'pcp-active' ? !e.target.checked : e.target.checked)}
                    disabled={isDisabled}
                  />
                }
                label={item.label}
              />
            )}
          />
        );
      default:
        return (
          <FormTextField
            name={item.key}
            control={control}
            disabled={isDisabled}
            rules={rules}
            id={omitRowWrapper ? item.key : undefined}
            key={item.key}
            inputProps={{ mask, placeholder }}
            InputProps={mask ? { inputComponent: InputMask as any } : undefined}
          />
        );
    }
  })();

  if (omitRowWrapper) {
    return InputElement;
  }

  return (
    <Row label={item.type === 'boolean' ? '' : item.label} inputId={item.key} required={isRequired}>
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
  answerSource: { resourceType: string; query: string; prependedIdentifier?: string };
};

interface DynamicReferenceFieldProps {
  item: Omit<FormFieldsItem, 'options'>;
  optionStrategy: ValueSetStrategy | AnswerSourceStrategy;
  id?: string;
  rules?: RegisterOptions;
}

const DynamicReferenceField: FC<DynamicReferenceFieldProps> = ({ item, optionStrategy, id, rules }) => {
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
      rules={rules}
      render={({ field: { value }, fieldState: { error } }) => {
        const selectedOption = answerOptions?.find((option) => option.reference === value?.reference);
        return (
          <Autocomplete
            options={answerOptions ?? []}
            loading={isLoading || isRefetching}
            id={id}
            loadingText={'Loading...'}
            value={selectedOption ?? {}}
            isOptionEqualToValue={(option, value) => {
              return option?.id === value?.id;
            }}
            getOptionLabel={(option) => (option.display ? option.display : '-')}
            onChange={(_, newValue) => {
              if (newValue) {
                setValue(item.key, { ...newValue }, { shouldDirty: true });
              } else {
                setValue(item.key, null, { shouldDirty: true });
              }
            }}
            disableClearable
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
