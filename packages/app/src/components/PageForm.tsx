import { yupResolver } from '@hookform/resolvers/yup';
import { Grid, TextFieldProps, Typography, Box } from '@mui/material';
import { FC, ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { emailRegex, phoneRegex, stateRegex, yupDateRegex, yupDateTransform, zipRegex } from '../helpers';
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
  type:
    | 'Text'
    | 'Select'
    | 'Radio'
    | 'Radio List'
    | 'Free Select'
    | 'Date'
    | 'File'
    | 'Checkbox'
    | 'Header 3'
    | 'Description';
  format?: 'Phone Number' | 'Email' | 'State' | 'ZIP' | 'Signature';
  name: string;
  label?: string;
  document?: ReactElement;
  width?: number;
  freeSelectOptions?: string[];
  selectOptions?: SelectInputOption[];
  radioOptions?: RadioOption[];
  radioStyling?: RadioStyling;
  fileOptions?: FileUploadOptions;
  borderColor?: string;
  borderSelected?: string;
  backgroundSelected?: string;
  hidden?: boolean;
  mask?: string;
  helperText?: string;
  onChange?: any;
  validationRegex?: RegExp;
  validationRegexError?: string;
} & TextFieldProps;

interface PageFormProps {
  formElements?: FormInput[];
  onSubmit?: any;
  controlButtons?: ControlButtonsProps;
  bottomComponent?: ReactElement;
}

export const PageForm: FC<PageFormProps> = ({
  formElements,
  onSubmit,
  controlButtons,
  bottomComponent,
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
            formInput.validationRegex = emailRegex;
            formInput.validationRegexError = 'Email is not valid';
            break;

          case 'Phone Number':
            formInput.placeholder = '(123) 456-7890';
            formInput.validationRegex = phoneRegex;
            formInput.validationRegexError = 'Phone number must be 10 digits in the format (xxx) xxx-xxxx';
            formInput.mask = '(000) 000-0000';
            break;

          case 'Signature':
            formInput.placeholder = 'Type out your full name';
            break;

          case 'State':
            formInput.validationRegex = stateRegex;
            formInput.validationRegexError = 'State must be 2 letters';
            break;

          case 'ZIP':
            formInput.validationRegex = zipRegex;
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
                    message: formInput.validationRegexError,
                    excludeEmptyString: true,
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
                    .matches(yupDateRegex, 'Date must be in the format MM/DD/YYYY')
                : schema;
            });
        }
      });
  const validationSchema = Yup.object().shape(validation);

  const methods = useForm({
    resolver: yupResolver(validationSchema),
    context: {
      validationRegex: true,
      required: true,
      formInputType: true,
    },
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} style={{ width: '100%' }}>
        {formElements && (
          <Grid container spacing={1}>
            {formElements
              .filter((formInput) => !formInput.hidden)
              .map((formInput) => (
                <Grid item xs={formInput.width || 12} key={formInput.name}>
                  {(() => {
                    switch (formInput.type) {
                      case 'Checkbox':
                        return (
                          <ControlledCheckBox
                            name={formInput.name}
                            label={formInput.label}
                            defaultValue={formInput.defaultValue === 'true'}
                            required={formInput.required}
                            document={formInput.document}
                          />
                        );
                      case 'Date':
                        return (
                          <DateInput
                            name={formInput.name}
                            label={formInput.label || 'No label'}
                            helperText={formInput.helperText}
                            defaultValue={formInput.defaultValue}
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
                            name={formInput.name}
                            label={formInput.label || 'No label'}
                            defaultValue={formInput.defaultValue as string}
                            options={formInput.fileOptions}
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
                            // onChange={(event) => {
                            //   const target = event.target as HTMLInputElement;
                            //   methods.setValue(formInput.name, target.value);
                            //   formInput.onChange(event);
                            // }}
                          />
                        );
                      case 'Header 3':
                        return (
                          <Box mb={1}>
                            <Typography variant="h3" color="secondary">
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
                            name={formInput.name}
                            label={formInput.label || 'No label'}
                            helperText={formInput.helperText}
                            required={formInput.required}
                            options={formInput.radioOptions}
                            borderColor={formInput.borderColor}
                            borderSelected={formInput.borderSelected}
                            backgroundSelected={formInput.backgroundSelected}
                            getSelected={methods.watch}
                            radioStyling={formInput.radioStyling}
                            defaultValue={formInput.defaultValue}
                            onChange={(event) => {
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
                            onChange={(event) => {
                              const target = event.target as HTMLInputElement;
                              methods.setValue(formInput.name, target.value);
                              if (formInput.onChange) {
                                formInput.onChange(event);
                              }
                            }}
                          />
                        );
                      case 'Text':
                        return (
                          <FormInput
                            name={formInput.name}
                            label={formInput.label || 'No label'}
                            format={formInput.format}
                            helperText={formInput.helperText}
                            defaultValue={formInput.defaultValue || ''}
                            required={formInput.required}
                            placeholder={formInput.placeholder}
                            mask={formInput.mask}
                            multiline={formInput.multiline}
                            minRows={formInput.minRows}
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
