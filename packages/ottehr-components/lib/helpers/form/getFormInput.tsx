import { FormInputTypeField, FormInputTypeGroup } from '../../types';
import { FieldValues } from 'react-hook-form';
import { ReactElement } from 'react';
import { Box, Button, Grid, Typography } from '@mui/material';
import {
  ControlledCheckBox,
  DateInput,
  FileUpload,
  FormInput,
  FormList,
  FreeMultiSelectInput,
  RadioInput,
  RadioListInput,
  SelectInput,
  YearInput,
} from '../../components';
import CoalescedDateInput from '../../components/form/CoalescedDateInput';
import { DateFieldMap } from '../../components/form/DateInput';

function checkRequire(item: FormInputTypeField, values: FieldValues): boolean {
  if (item.required && !item.requireWhen) {
    return true;
  }

  if (item.requireWhen) {
    const value = values[item.requireWhen.question];
    if (item.requireWhen.operator === '=') {
      return value === item.requireWhen.answer;
    }
  }

  return false;
}

export const getFormInputGroup = (formInput: FormInputTypeGroup): ReactElement => {
  // one day I will kill this...
  return (
    <DateInput
      name={formInput.name}
      label={formInput.label}
      helperText={formInput.helperText}
      fieldMap={formInput.fieldMap as DateFieldMap}
      required={formInput.required}
    />
  );
};

export const getFormInputField = (formInput: FormInputTypeField, values: FieldValues, methods: any): ReactElement => {
  return (
    <Grid item xs={12} md={formInput.width} key={formInput.name}>
      {(() => {
        formInput.required = checkRequire(formInput, values);

        switch (formInput.type) {
          case 'Text':
            return (
              <FormInput
                name={formInput.name}
                label={formInput.label || 'No label'}
                format={formInput.format}
                infoText={formInput.infoText}
                helperText={formInput.helperText}
                defaultValue={formInput.defaultValue || ''}
                required={formInput.required}
                placeholder={formInput.placeholder}
                mask={formInput.mask}
                multiline={formInput.multiline}
                minRows={formInput.minRows}
              />
            );
          case 'Checkbox':
            return (
              <ControlledCheckBox
                name={formInput.name}
                label={formInput.label}
                defaultValue={formInput.defaultValue === true}
                required={formInput.required}
              />
            );
          case 'Date':
            return (
              <CoalescedDateInput
                name={formInput.name}
                required={formInput.required}
                label={formInput.label}
                currentValue={values[formInput.name]}
                defaultValue={formInput.defaultValue as string | undefined}
                setCurrentValue={(newVal) => {
                  methods.setValue(formInput.name, newVal);
                }}
              />
            );
          case 'Year':
            return (
              <YearInput
                name={formInput.name}
                required={formInput.required}
                label={formInput.label}
                defaultValue={formInput.defaultValue as string | undefined}
                setCurrentValue={(newVal) => {
                  methods.setValue(formInput.name, newVal);
                }}
              />
            );
          case 'Select':
            if (!formInput.selectOptions) {
              throw new Error('No selectOptions given in select');
            }
            return (
              <SelectInput
                name={formInput.name}
                label={formInput.label || 'No label'}
                helperText={formInput.helperText}
                placeholder={formInput.placeholder}
                defaultValue={formInput.defaultValue}
                required={formInput.required}
                options={formInput.selectOptions}
                infoTextSecondary={formInput.infoTextSecondary}
                onChange={(event) => {
                  const target = event.target as HTMLInputElement;
                  methods.setValue(formInput.name, target.value);
                  if (formInput.onChange) {
                    formInput.onChange(event);
                  }
                }}
              />
            );
          case 'Free Select':
            if (!formInput.freeSelectOptions) {
              throw new Error('No freeSelectOptions given in free select');
            }
            return (
              <FreeMultiSelectInput
                name={formInput.name}
                label={formInput.label || 'No label'}
                placeholder={formInput.placeholder}
                helperText={formInput.helperText}
                required={formInput.required}
                defaultValue={formInput.defaultValue as string[]}
                options={formInput.freeSelectOptions}
              />
            );
          case 'Radio':
            if (!formInput.radioOptions) {
              throw new Error('No radioOptions given in select');
            }
            return (
              <RadioInput
                name={formInput.name}
                label={formInput.label || 'No label'}
                helperText={formInput.helperText}
                required={formInput.required}
                options={formInput.radioOptions}
                borderColor={formInput.borderColor}
                borderSelected={formInput.borderSelected}
                backgroundSelected={formInput.backgroundSelected}
                getSelected={methods.watch}
                // radioStyling={{
                //   radio: {
                //     alignSelf: 'center',
                //     marginY: 'auto',
                //   },
                //   label: {
                //     ...theme.typography.body2,
                //     color: theme.palette.text.primary,
                //   },
                // }}
                radioStyling={formInput.radioStyling}
                defaultValue={formInput.defaultValue}
                onChange={(event) => {
                  if (formInput.onChange) {
                    formInput.onChange(event);
                  }
                  const target = event.target as HTMLInputElement;
                  methods.setValue(formInput.name, target.value);
                }}
              />
            );
          case 'Radio List':
            if (!formInput.radioOptions) {
              throw new Error('No radioOptions given in select');
            }
            return (
              <RadioListInput
                name={formInput.name}
                label={formInput.label || 'No label'}
                helperText={formInput.helperText}
                required={formInput.required}
                value={formInput.value ?? ''}
                options={formInput.radioOptions}
                defaultValue={formInput.defaultValue}
                onChange={(event) => {
                  const target = event.target as HTMLInputElement;
                  methods.setValue(formInput.name, target.value);
                  if (formInput.onChange) {
                    formInput.onChange(event);
                  }
                }}
                // radioStyling={{
                //   alignSelf: 'start',
                //   mt: '8px',
                // }}
              />
            );
          case 'File':
            if (!formInput.fileOptions) {
              throw new Error('No fileOptions given in file input');
            }
            return (
              <FileUpload
                name={formInput.name}
                label={formInput.label || 'No label'}
                defaultValue={formInput.defaultValue as string}
                options={formInput.fileOptions}
              />
            );
          case 'Header 3':
            return (
              <Box mb={1}>
                <Typography variant="h3" color="primary">
                  {formInput.label}
                </Typography>
              </Box>
            );
          case 'Header 4':
            return (
              <Box mb={1}>
                <Typography variant="h4" color="primary">
                  {formInput.label}
                </Typography>
              </Box>
            );
          case 'Description':
            return <Typography variant="body1">{formInput.label}</Typography>;
          case 'Button':
            return (
              <Button variant="outlined" type="submit">
                {formInput.label}
              </Button>
            );
          case 'Form list':
            return <FormList formInput={formInput} values={methods.watch()} methods={methods} />;
          default:
            console.log(formInput);
            console.log('Form input type without a match', formInput.type);
            throw new Error('Form input type without a match');
        }
      })()}
    </Grid>
  );
};
