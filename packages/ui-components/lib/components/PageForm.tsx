import { yupResolver } from '@hookform/resolvers/yup';
import { Box, Grid, Typography } from '@mui/material';
import React, { ReactElement } from 'react';
import { FieldValues, FormProvider, useForm } from 'react-hook-form';
import { emailRegex, emojiRegex, phoneRegex, yupDateTransform, yupFHIRDateRegex, zipRegex } from 'utils';
import * as Yup from 'yup';
import { checkEnable } from '../helpers';
import { ControlButtonsProps, FormInputType } from '../types';
import {
  ControlButtons,
  ControlledCheckBox,
  DateInput,
  FileUpload,
  FormInput,
  FreeMultiSelectInput,
  RadioInput,
  RadioListInput,
  SelectInput,
} from './form';

interface props {
  formElements?: FormInputType[];
  onSubmit?: any;
  controlButtons?: ControlButtonsProps;
  bottomComponent?: ReactElement;
}

function checkRequire(item: FormInputType, values: FieldValues): boolean {
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

const PageForm: React.FC<props> = ({ formElements, onSubmit, controlButtons, bottomComponent }): JSX.Element => {
  // todo do in one line?
  // todo use more specific type
  // const validation: any = {
  //   validationRegex: Yup.boolean(),
  //   required: Yup.boolean(),
  // };
  const [validation, setValidation] = React.useState<any>({});
  const [formValues, setFormValues] = React.useState<any>({});

  React.useEffect(() => {
    const validationTemp: any = {};
    formElements &&
      formElements.forEach((formInput) => {
        // We do checkEnable instead of filter
        // because formInput.hidden is sometimes not
        // set until checkEnable is called
        if (!checkEnable(formInput, formValues)) {
          return;
        }
        if (formInput.format === 'Phone Number') {
          formInput.placeholder = '(XXX) XXX-XXXX';
          formInput.validationRegex = phoneRegex;
          formInput.validationRegexError = 'Phone number must be 10 digits in the format (xxx) xxx-xxxx';
          formInput.mask = '(000) 000-0000';
        }

        if (formInput.format === 'Email') {
          formInput.placeholder = 'example@mail.com';
          formInput.validationRegex = emailRegex;
          formInput.validationRegexError = 'Email is not valid';
        }

        if (formInput.format === 'ZIP') {
          formInput.validationRegex = zipRegex;
          formInput.validationRegexError = 'ZIP Code must be 5 numbers';
        }

        if (formInput.format === 'Signature') {
          formInput.placeholder = 'Type out your full name';
        }

        if (formInput.type === 'Free Select') {
          validationTemp[formInput.name] = Yup.array()
            .when('$required', (_required, schema) => {
              return formInput.required ? schema.min(1, `${formInput.label} is required`) : schema;
            })
            .test('char-limit', `Input cannot be more than ${formInput.characterLimit} characters`, (inputs) => {
              return formInput.characterLimit ? (inputs ?? []).join(', ').length <= formInput.characterLimit : true;
            })
            .test('no-emoji', 'Emojis are not a valid character', (inputs) => {
              return emojiRegex.test((inputs ?? []).join(''));
            });
        } else if (formInput.type === 'Radio List') {
          validationTemp[formInput.name] = Yup.string().when('$required', (_required, schema) => {
            return formInput.required ? schema.required(`Selection is required`) : schema;
          });
        } else {
          validationTemp[formInput.name] = Yup.string()
            .when('$validationRegex', (_validationRegex, schema) => {
              return formInput.validationRegex
                ? schema.matches(formInput.validationRegex, {
                    message: formInput.validationRegexError,
                    excludeEmptyString: true,
                  })
                : schema;
            })
            .when('$formInputType', (_formInputType, schema) => {
              if (formInput.type === 'Text') {
                return schema
                  .transform((value: string) => value.trim())
                  .matches(emojiRegex, {
                    message: 'Emojis are not a valid character',
                    excludeEmptyString: true,
                  });
              } else if (formInput.type === 'Date') {
                return schema
                  .transform(yupDateTransform)
                  .typeError('Date must be in the format MM/DD/YYYY')
                  .matches(yupFHIRDateRegex, 'Date must be in the format MM/DD/YYYY');
              } else {
                return schema;
              }
            })
            .when('$required', (_required, schema) => {
              return formInput.required ? schema.required(`${formInput.label} is required`) : schema;
            });
        }
      });
    setValidation(validationTemp);
  }, [formElements, formValues]);

  const validationSchema = Yup.object().shape(validation);
  const methods = useForm({
    resolver: yupResolver(validationSchema),
    context: {
      validationRegex: true,
      required: true,
      formInputType: true,
    },
  });

  const values = methods.watch();
  React.useEffect(() => {
    if (JSON.stringify(values) !== JSON.stringify(formValues)) {
      setFormValues(values);
    }
  }, [formValues, values]);

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} style={{ width: '100%' }}>
        {formElements && (
          <Grid container spacing={1}>
            {formElements
              .filter((formInput) => checkEnable(formInput, values))
              .filter((formInput) => !formInput.hidden)
              .map((formInput) => (
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
                      case 'Checkbox':
                        return (
                          <ControlledCheckBox
                            name={formInput.name}
                            label={formInput.label}
                            defaultValue={formInput.defaultValue === true}
                            required={formInput.required}
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
                            color="primary"
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
                      case 'Description':
                        return <Typography variant="body1">{formInput.label}</Typography>;
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

export default PageForm;
