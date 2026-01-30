import { Autocomplete, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { QuestionnaireItemAnswerOption, Reference } from 'fhir/r4b';
import { FC, useEffect, useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { BasicDatePicker, FormSelect, FormTextField } from 'src/components/form';
import InputMask from 'src/components/InputMask';
import { Row } from 'src/components/layout';
import { useApiClients } from 'src/hooks/useAppClients';
import { dedupeObjectsByKey, FormFieldsDisplayItem, FormFieldsInputItem } from 'utils';
import { evaluateFieldTriggers } from './patientRecordValidation';

interface PatientRecordFormFieldProps {
  item: FormFieldsInputItem | FormFieldsDisplayItem;
  isLoading: boolean;
  hiddenFormFields?: string[];
  requiredFormFields?: string[];
  omitRowWrapper?: boolean;
  disabled?: boolean;
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

  const { enableBehavior = 'any', disabledDisplay } = item;

  let dynamicPopulation: FormFieldsInputItem['dynamicPopulation'];
  if (item.type !== 'display') {
    dynamicPopulation = item.dynamicPopulation;
  }

  // Get current form values for trigger evaluation
  const formValues = watch();

  // Evaluate triggers using the utility function
  const triggeredEffects = evaluateFieldTriggers(item, formValues, enableBehavior);

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

  let placeholder: string | undefined;
  let mask: string | undefined;
  if (item.type !== 'display' && item.dataType === 'Phone Number') {
    placeholder = '(XXX) XXX-XXXX';
    mask = '(000) 000-0000';
  }
  if (item.type !== 'display' && item.dataType === 'SSN') {
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
            />
          );
        }
        if (item.options?.length && item.options.length > 10) {
          return (
            <Controller
              name={item.key}
              control={control}
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
          />
        );
      case 'date':
        return (
          <BasicDatePicker
            id={omitRowWrapper ? item.key : undefined}
            name={item.key}
            control={control}
            disabled={isDisabled}
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

  if (item.type === 'display') {
    return <></>; // no use of display type fields in this context for now
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
  item: Omit<FormFieldsInputItem | FormFieldsDisplayItem, 'options'>;
  optionStrategy: ValueSetStrategy | AnswerSourceStrategy;
  id?: string;
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
