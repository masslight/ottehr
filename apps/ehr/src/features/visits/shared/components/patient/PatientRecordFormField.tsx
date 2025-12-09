import { Autocomplete, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { QuestionnaireItemAnswerOption, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { BasicDatePicker, FormSelect, FormTextField } from 'src/components/form';
import InputMask from 'src/components/InputMask';
import { Row } from 'src/components/layout';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  dedupeObjectsByKey,
  FormFieldsItem,
  ORG_TYPE_CODE_SYSTEM,
  ORG_TYPE_PAYER_CODE,
  REQUIRED_FIELD_ERROR_MESSAGE,
} from 'utils';

interface PatientRecordFormFieldProps {
  item: FormFieldsItem;
  isLoading: boolean;
  hiddenFormFields?: string[];
  requiredFormFields?: string[];
  omitRowWrapper?: boolean;
  disabled?: boolean;
}

/*

*/

const PatientRecordFormField: FC<PatientRecordFormFieldProps> = ({
  item,
  hiddenFormFields,
  requiredFormFields,
  isLoading,
  omitRowWrapper = false,
  disabled = false,
}) => {
  const { control, setValue } = useFormContext();
  const isHidden = hiddenFormFields?.includes(item.key);
  if (isHidden) {
    return null;
  }

  const isRequired = requiredFormFields?.includes(item.key);

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

  const isDisabled = disabled || isLoading;

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

  if (item.key === 'insurance-carrier') {
    console.log('Rendering insurance carrier field', item.type);
  }

  const InputElement = (() => {
    switch (item.type) {
      case 'choice':
      case 'reference':
        if (item.type === 'reference') {
          return (
            <DynamicReferenceField
              item={item}
              id={omitRowWrapper ? item.key : undefined}
              optionStrategy={{
                type: 'answerSource',
                answerSource: {
                  resourceType: 'Organization',
                  query: `type=${ORG_TYPE_CODE_SYSTEM}|${ORG_TYPE_PAYER_CODE}`,
                },
              }}
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
                    // data-testid={dataTestIds.contactInformationContainer.state}
                    onChange={(_, newValue) => {
                      console.log('New value selected for', item.key, newValue);
                      if (newValue) {
                        setValue(item.key, newValue.value);
                      } else {
                        setValue(item.key, '');
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
            // data-testid={dataTestIds.patientInformationContainer.patientBirthSex}
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
            // dataTestId={dataTestIds.patientInformationContainer.patientDateOfBirth}
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
                    checked={item.key === 'pcp-active' ? !(value ?? false) : value ?? false} // this is incredibly silly but needed to invert the logic for this one field
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

type AnswerSourceStrategy = {
  type: 'answerSource';
  answerSource: { resourceType: string; query: string };
};

interface DynamicReferenceFieldProps {
  item: Omit<FormFieldsItem, 'options'>;
  optionStrategy: ValueSetStrategy | AnswerSourceStrategy;
  id?: string;
}

const DynamicReferenceField: FC<DynamicReferenceFieldProps> = ({ optionStrategy, item, id }) => {
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
    data: insuranceOptions,
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
      rules={{
        required: REQUIRED_FIELD_ERROR_MESSAGE,
      }}
      render={({ field: { value }, fieldState: { error } }) => {
        const selectedOption = insuranceOptions?.find((option) => option.reference === value?.reference);
        return (
          <Autocomplete
            options={insuranceOptions ?? []}
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
              <TextField {...params} variant="standard" error={!!error} required helperText={error?.message} />
            )}
          />
        );
      }}
    />
  );
};

export default PatientRecordFormField;
