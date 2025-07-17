import { Box, Button, Grid, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { FieldValues } from 'react-hook-form';
import { FileURLs } from 'utils';
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
} from '../../components/form';
import CoalescedDateInput from '../../components/form/CoalescedDateInput';
import { DateFieldMap } from '../../components/form/DateInput';
import { PhotosUpload } from '../../components/form/PhotosUpload';
import { FormInputTypeField, FormInputTypeGroup, OverrideValues } from '../../types';

function checkRequire(item: FormInputTypeField, values: FieldValues): boolean {
  if (item.required && !item.requireWhen) {
    return true;
  }

  if (item.requireWhen) {
    const value = values[item.requireWhen.question];
    if (item.requireWhen.operator === '=') {
      return value === item.requireWhen.answer;
    }
    if (value && item.requireWhen.operator === 'includes') {
      return value.includes(item.requireWhen.answer);
    }
    if (value && item.requireWhen.operator === 'contains') {
      return item.requireWhen.answer.includes(value);
    }
  }

  return false;
}

function checkDisable(item: FormInputTypeField, values: FieldValues): boolean {
  if (item.disableWhen) {
    const value = values[item.disableWhen.question];
    if (item.disableWhen.operator === '=') {
      return value === item.disableWhen.answer;
    }
  }

  return false;
}

export const getFormInputGroup = (formInput: FormInputTypeGroup): ReactElement => {
  return (
    <DateInput
      name={formInput.name}
      label={formInput.label}
      helperText={formInput.helperText}
      showHelperTextIcon={formInput.showHelperTextIcon}
      fieldMap={formInput.fieldMap as DateFieldMap}
      required={formInput.required}
      key={formInput.name}
    />
  );
};

export const getFormInputField = (
  formInput: FormInputTypeField,
  values: FieldValues,
  methods: any,
  overrideValues?: OverrideValues
): ReactElement => {
  return (
    <Grid item xs={12} md={formInput.width} key={formInput.name}>
      {(() => {
        formInput.required = checkRequire(formInput, values);

        formInput.disabled = checkDisable(formInput, values);
        const disableWhenValue = formInput.disableWhen?.value;
        if (formInput.disabled && disableWhenValue && overrideValues) {
          formInput.readOnlyValue = overrideValues[disableWhenValue];
        } else {
          formInput.readOnlyValue = undefined;
        }

        switch (formInput.type) {
          case 'Text':
            return (
              <FormInput
                name={formInput.name}
                label={formInput.label || 'No label'}
                format={formInput.format}
                infoText={formInput.infoText}
                helperText={formInput.helperText}
                autoComplete={formInput.autoComplete}
                showHelperTextIcon={formInput.showHelperTextIcon}
                infoTextSecondary={formInput.infoTextSecondary}
                defaultValue={formInput.defaultValue || ''}
                required={formInput.required}
                placeholder={formInput.placeholder}
                mask={formInput.mask}
                multiline={formInput.multiline}
                minRows={formInput.minRows}
                maxRows={formInput.maxRows}
                disabled={formInput.disabled}
                maxCharacters={formInput.maxCharacters}
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
                readOnlyValue={formInput.readOnlyValue}
                disabled={formInput.disabled}
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
                showHelperTextIcon={formInput.showHelperTextIcon}
                placeholder={formInput.placeholder}
                defaultValue={formInput.defaultValue}
                required={formInput.required}
                options={formInput.selectOptions}
                infoTextSecondary={formInput.infoTextSecondary}
                disabled={formInput.disabled}
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
                showHelperTextIcon={formInput.showHelperTextIcon}
                infoTextSecondary={formInput.infoTextSecondary}
                required={formInput.required}
                multiple={formInput.freeSelectMultiple}
                freeSolo={formInput.freeSelectFreeSolo}
                submitOnChange={formInput.submitOnChange}
                disableError={formInput.disableError}
                virtualization={formInput.virtualization}
                defaultValue={
                  formInput.freeSelectMultiple === false
                    ? (formInput.defaultValue as string)
                    : (formInput.defaultValue as string[])
                }
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
                showHelperTextIcon={formInput.showHelperTextIcon}
                infoTextSecondary={formInput.infoTextSecondary}
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
                showHelperTextIcon={formInput.showHelperTextIcon}
                infoTextSecondary={formInput.infoTextSecondary}
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
                fileUploadType={formInput.fileUploadType}
                options={formInput.fileOptions}
                required={formInput.required}
              />
            );
          case 'Photos':
            if (!formInput.fileOptions) {
              throw new Error('No fileOptions given in photos input');
            }
            return (
              <PhotosUpload
                name={formInput.name}
                label={formInput.label || ''}
                defaultValue={formInput.defaultValue as FileURLs}
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
            if (formInput.label) {
              return <Typography variant="body1">{formInput.label}</Typography>;
            } else if (formInput.description) {
              return formInput.description;
            } else {
              return <></>;
            }
          case 'Button':
            return (
              <Button
                variant="outlined"
                color={formInput.buttonProps?.color}
                type={formInput.buttonProps?.onClick ? 'button' : 'submit'}
                onClick={formInput.buttonProps?.onClick}
                startIcon={formInput.buttonProps?.startIcon}
              >
                {formInput.label}
              </Button>
            );
          case 'Form list':
            return <FormList formInput={formInput} />;
          default:
            console.log(formInput);
            console.log('Form input type without a match', formInput.type);
            throw new Error('Form input type without a match');
        }
      })()}
    </Grid>
  );
};
