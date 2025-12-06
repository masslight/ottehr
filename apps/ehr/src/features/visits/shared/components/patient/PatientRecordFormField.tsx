import { Autocomplete, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { BasicDatePicker, FormSelect, FormTextField } from 'src/components/form';
import { Row } from 'src/components/layout';
import { FormFieldsItem, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

interface PatientRecordFormFieldProps {
  item: FormFieldsItem;
  isLoading: boolean;
  hiddenFormFields?: string[];
  requiredFormFields?: string[];
  omitRowWrapper?: boolean;
  disabled?: boolean;
}

/*

todo: add this validation concept for insurance priority:

validate: (value, context) => {
              // todo: this validation concept would be good to lift into the paperwork validation engine
              const otherGroupKey = PATIENT_RECORD_CONFIG.formValueSets.insurancePriorityOptions.find(
                (key) => key.value !== FormFields.insurancePriority.key
              )?.value;
              let otherGroupValue: 'Primary' | 'Secondary' | undefined;
              if (otherGroupKey) {
                otherGroupValue = context[otherGroupKey];
              }
              if (otherGroupValue === value) {
                return `Account may not have two ${value.toLowerCase()} insurance plans`;
              }
              return true;
            },


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
    if (isRequired) {
      return { required: REQUIRED_FIELD_ERROR_MESSAGE };
    }
    return undefined;
  })();

  const isDisabled = disabled || isLoading;

  const InputElement = (() => {
    switch (item.type) {
      case 'choice':
        if (item.options?.length && item.options.length > 10) {
          return (
            <Controller
              name={item.key}
              control={control}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
              }}
              render={({ field: { value }, fieldState: { error } }) => {
                return (
                  <Autocomplete
                    options={(item.options ?? []).map((option) => option.value)}
                    value={value ?? ''}
                    // data-testid={dataTestIds.contactInformationContainer.state}
                    onChange={(_, newValue) => {
                      if (newValue) {
                        setValue(item.key, newValue);
                      } else {
                        setValue(item.key, '');
                      }
                    }}
                    disableClearable
                    fullWidth
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="standard"
                        error={!!error}
                        required
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
            id={item.key}
            name={item.key}
            control={control}
            disabled={isDisabled}
            rules={rules ?? {}}
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
                    checked={value ?? false}
                    onChange={(e) => field.onChange(e.target.checked)}
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
            id={item.key}
            key={item.key}
            // inputProps={{ mask: '(000) 000-0000' }} todo: phone number, ssn, etc.
            // InputProps={{ inputComponent: InputMask as any}}
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

export default PatientRecordFormField;
