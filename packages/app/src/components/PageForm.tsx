import { yupResolver } from '@hookform/resolvers/yup';
import { Grid, TextFieldProps, Typography, Box } from '@mui/material';
import { FC, ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { regex, yupDateTransform } from '../helpers';
import { RadioOption } from '../types';
import { ControlButtons, ControlButtonsProps } from './ControlButtons';
import { ControlledCheckBox } from './ControlledCheckBox';
import { DateInput } from './DateInput';
import { FileUpload, FileUploadOptions } from './FileUpload';
import { FormInput } from './FormInput';
import { FreeMultiSelectInput } from './FreeMultiSelectInput';
import { RadioInput, RadioStyling } from './RadioInput';
import { RadioListInput } from './RadioListInput';
import { SelectInput, SelectInputOption } from './SelectInput';

type FormInput = {
  backgroundSelected?: string;
  borderColor?: string;
  borderSelected?: string;
  document?: ReactElement;
  fileOptions?: FileUploadOptions;
  format?: 'Email' | 'Phone Number' | 'Signature' | 'State' | 'ZIP';
  freeSelectOptions?: string[];
  helperText?: string;
  hidden?: boolean;
  label?: string;
  mask?: string;
  name: string;
  onChange?: any;
  radioOptions?: RadioOption[];
  radioStyling?: RadioStyling;
  selectOptions?: SelectInputOption[];
  type:
    | 'Checkbox'
    | 'Date'
    | 'Description'
    | 'File'
    | 'Free Select'
    | 'Header 3'
    | 'Radio'
    | 'Radio List'
    | 'Select'
    | 'Text';
  validationRegex?: RegExp;
  validationRegexError?: string;
  width?: number;
} & TextFieldProps;

interface PageFormProps {
  bottomComponent?: ReactElement;
  controlButtons?: ControlButtonsProps;
  formElements?: FormInput[];
  onSubmit?: any;
}

export const PageForm: FC<PageFormProps> = ({
  bottomComponent,
  controlButtons,
  formElements,
  onSubmit,
}): JSX.Element => {
  // todo do in one line?
  // todo use more specific type
  // const validation: any = {
  //   validationRegex: Yup.boolean(),
  //   required: Yup.boolean(),
  // };
  const validation: any = {};

  formElements &&
    formElements
      .filter((formInput) => !formInput.hidden)
      .forEach((formInput) => {
        switch (formInput.format) {
          case 'Email':
            formInput.placeholder = 'jon@snow.com';
            formInput.validationRegex = regex.email;
            formInput.validationRegexError = 'Email is not valid';
            break;

          case 'Phone Number':
            formInput.mask = '(000) 000-0000';
            formInput.placeholder = '(123) 456-7890';
            formInput.validationRegex = regex.phone;
            formInput.validationRegexError = 'Phone number must be 10 digits in the format (xxx) xxx-xxxx';
            break;

          case 'Signature':
            formInput.placeholder = 'Type out your full name';
            break;

          case 'State':
            formInput.validationRegex = regex.state;
            formInput.validationRegexError = 'State must be 2 letters';
            break;

          case 'ZIP':
            formInput.validationRegex = regex.zip;
            formInput.validationRegexError = 'ZIP Code must be 5 numbers';
            break;
        }

        // if (formInput.type === 'Text') {
        //   if (formInput.defaultValue === '') {
        //     formInput.defaultValue = undefined;
        //   }
        // }

        if (formInput.type === 'Free Select') {
          validation[formInput.name] = Yup.array().when('$required', (required, schema) => {
            return formInput.required ? schema.min(1, `${formInput.label} is required`) : schema;
          });
        } else if (formInput.type === 'Radio List') {
          validation[formInput.name] = Yup.string().when('$required', (required, schema) => {
            return formInput.required ? schema.required(`Selection is required`) : schema;
          });
        } else {
          validation[formInput.name] = Yup.string()
            .when('$validationRegex', (_, schema) => {
              return formInput.validationRegex
                ? schema.matches(formInput.validationRegex, {
                    excludeEmptyString: true,
                    message: formInput.validationRegexError,
                  })
                : schema;
            })
            .when('$required', (_, schema) => {
              return formInput.required ? schema.required(`${formInput.label} is required`) : schema;
            })
            .when('$formInputType', (_, schema) => {
              return formInput.type === 'Date'
                ? schema
                    .transform(yupDateTransform)
                    .typeError('Date must be in the format MM/DD/YYYY')
                    .matches(regex.yupDate, 'Date must be in the format MM/DD/YYYY')
                : schema;
            });
        }
      });
  const validationSchema = Yup.object().shape(validation);

  const methods = useForm({
    context: {
      formInputType: true,
      required: true,
      validationRegex: true,
    },
    resolver: yupResolver(validationSchema),
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} style={{ width: '100%' }}>
        {formElements && (
          <Grid container spacing={1}>
            {formElements
              .filter((formInput) => !formInput.hidden)
              .map((formInput) => (
                <Grid key={formInput.name} item xs={formInput.width || 12}>
                  {(() => {
                    switch (formInput.type) {
                      case 'Checkbox':
                        return (
                          <ControlledCheckBox
                            defaultValue={formInput.defaultValue === 'true'}
                            document={formInput.document}
                            label={formInput.label}
                            name={formInput.name}
                            required={formInput.required}
                          />
                        );
                      case 'Date':
                        return (
                          <DateInput
                            defaultValue={formInput.defaultValue}
                            helperText={formInput.helperText}
                            label={formInput.label || 'No label'}
                            name={formInput.name}
                            required={formInput.required}
                          />
                        );
                      case 'Description':
                        return <Typography variant="body1">{formInput.name}</Typography>;
                      case 'File':
                        if (!formInput.fileOptions) {
                          throw new Error('No fileOptions given in file input');
                        }
                        return (
                          <FileUpload
                            defaultValue={formInput.defaultValue as string}
                            label={formInput.label || 'No label'}
                            name={formInput.name}
                            options={formInput.fileOptions}
                          />
                        );
                      case 'Free Select':
                        if (!formInput.freeSelectOptions) {
                          throw new Error('No freeSelectOptions given in free select');
                        }
                        return (
                          <FreeMultiSelectInput
                            defaultValue={formInput.defaultValue as string[]}
                            helperText={formInput.helperText}
                            label={formInput.label || 'No label'}
                            name={formInput.name}
                            // onChange={(event) => {
                            //   const target = event.target as HTMLInputElement;
                            //   methods.setValue(formInput.name, target.value);
                            //   formInput.onChange(event);
                            // }}
                            options={formInput.freeSelectOptions}
                            placeholder={formInput.placeholder}
                            required={formInput.required}
                          />
                        );
                      case 'Header 3':
                        return (
                          <Box mb={1}>
                            <Typography color="secondary" variant="h3">
                              {formInput.name}
                            </Typography>
                          </Box>
                        );
                      case 'Radio':
                        if (!formInput.radioOptions) {
                          throw new Error('No radioOptions given in select');
                        }
                        return (
                          <RadioInput
                            backgroundSelected={formInput.backgroundSelected}
                            borderColor={formInput.borderColor}
                            borderSelected={formInput.borderSelected}
                            defaultValue={formInput.defaultValue}
                            getSelected={methods.watch}
                            helperText={formInput.helperText}
                            label={formInput.label || 'No label'}
                            name={formInput.name}
                            onChange={(event) => {
                              const target = event.target as HTMLInputElement;
                              methods.setValue(formInput.name, target.value);
                            }}
                            options={formInput.radioOptions}
                            radioStyling={formInput.radioStyling}
                            required={formInput.required}
                          />
                        );
                      case 'Radio List':
                        if (!formInput.radioOptions) {
                          throw new Error('No radioOptions given in select');
                        }
                        return (
                          <RadioListInput
                            defaultValue={formInput.defaultValue}
                            helperText={formInput.helperText}
                            label={formInput.label || 'No label'}
                            name={formInput.name}
                            onChange={(event) => {
                              const target = event.target as HTMLInputElement;
                              methods.setValue(formInput.name, target.value);
                              if (formInput.onChange) {
                                formInput.onChange(event);
                              }
                            }}
                            options={formInput.radioOptions}
                            // radioStyling={{
                            //   alignSelf: 'start',
                            //   mt: '8px',
                            // }}
                            required={formInput.required}
                            value={formInput.value ?? ''}
                          />
                        );
                      case 'Select':
                        if (!formInput.selectOptions) {
                          throw new Error('No selectOptions given in select');
                        }
                        return (
                          <SelectInput
                            defaultValue={formInput.defaultValue}
                            helperText={formInput.helperText}
                            label={formInput.label || 'No label'}
                            name={formInput.name}
                            onChange={(event) => {
                              const target = event.target as HTMLInputElement;
                              methods.setValue(formInput.name, target.value);
                              if (formInput.onChange) {
                                formInput.onChange(event);
                              }
                            }}
                            options={formInput.selectOptions}
                            placeholder={formInput.placeholder}
                            required={formInput.required}
                          />
                        );
                      case 'Text':
                        return (
                          <FormInput
                            defaultValue={formInput.defaultValue || ''}
                            format={formInput.format}
                            helperText={formInput.helperText}
                            label={formInput.label || 'No label'}
                            mask={formInput.mask}
                            minRows={formInput.minRows}
                            multiline={formInput.multiline}
                            name={formInput.name}
                            placeholder={formInput.placeholder}
                            required={formInput.required}
                          />
                        );
                      default:
                        throw new Error('Form input type without a match');
                    }
                  })()}
                </Grid>
              ))}
          </Grid>
        )}
        {bottomComponent}
        <ControlButtons {...controlButtons} />
      </form>
    </FormProvider>
  );
};
