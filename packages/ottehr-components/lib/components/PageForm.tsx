/* eslint-disable react/prop-types */
import { yupResolver } from '@hookform/resolvers/yup';
import { Grid } from '@mui/material';
import { DateTime } from 'luxon';
import React, { ReactElement, memo, useMemo } from 'react';
import { FieldValues, FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import {
  DATE_ERROR_MESSAGE,
  emailRegex,
  emojiRegex,
  phoneRegex,
  yupDateTransform,
  yupFHIRDateRegex,
  zipRegex,
} from 'ottehr-utils';
import * as Yup from 'yup';
import { checkEnable, filterFormInputFields } from '../helpers';
import { ControlButtonsProps, FormInputType, FormInputTypeField, FormInputTypeGroup } from '../types';
import { ControlButtons } from './form';

interface PageFormProps {
  formElements?: FormInputType[];
  // onSubmit?: SubmitHandler<FieldValues>;
  onSubmit?: any;
  controlButtons?: ControlButtonsProps;
  bottomComponent?: ReactElement;
  onFormValuesChange?: (values: FieldValues) => void;
  hideControls?: boolean;
  innerForm?: boolean;
}

// eslint-disable-next-line react/display-name
const PageForm: React.FC<PageFormProps> = memo(
  ({
    formElements,
    onSubmit,
    controlButtons,
    bottomComponent,
    onFormValuesChange,
    hideControls,
    innerForm,
  }): JSX.Element => {
    // todo do in one line?
    // todo use more specific type
    // const validation: any = {
    //   validationRegex: Yup.boolean(),
    //   required: Yup.boolean(),
    // };
    const flattenedElements: FormInputTypeField[] = useMemo(() => {
      return (formElements || []).flatMap((fe) => {
        if ((fe as any).fields === undefined) {
          return [fe as FormInputTypeField];
        } else {
          return [...(fe as FormInputTypeGroup).fields];
        }
      });
    }, [formElements]);
    const groups: FormInputTypeGroup[] = useMemo(() => {
      return (formElements || []).filter((fe) => {
        return (fe as any).fields !== undefined;
      }) as FormInputTypeGroup[];
    }, [formElements]);
    const [validation, setValidation] = React.useState<any>({});
    const [formValues, setFormValues] = React.useState<FieldValues>({});

    const validationSchema = Yup.object().shape(validation);
    const methods = useForm({
      resolver: yupResolver(validationSchema),
      context: {
        validationRegex: true,
        required: true,
        formInputType: true,
      },
      defaultValues: (() => {
        return flattenedElements.reduce((accum, currentInput) => {
          accum[currentInput.name] = currentInput.defaultValue;
          return accum;
        }, {} as any);
      })(),
    });

    React.useEffect(() => {
      const validationTemp: any = {};
      flattenedElements.forEach((formInput) => {
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
        } else if (formInput.type === 'Form list') {
          validationTemp[formInput.name] = Yup.array().when('$required', (_required, schema) => {
            return formInput.required
              ? schema.required(`At least one record is required`).min(1, `At least one record is required`)
              : schema;
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
                  .required(DATE_ERROR_MESSAGE)
                  .typeError(DATE_ERROR_MESSAGE)
                  .matches(yupFHIRDateRegex, DATE_ERROR_MESSAGE)
                  .test((str: string) => {
                    const provided = DateTime.fromISO(str);
                    const now = DateTime.now();
                    if (provided > now) {
                      return new Yup.ValidationError('Date may not be in the future', str, formInput.name);
                    }
                    return true;
                  });
              } else {
                return schema;
              }
            })
            .when('$required', (_required, schema) => {
              return formInput.required ? schema.required(`${formInput.label} is required`) : schema;
            });
        }
      });
      groups.forEach((formGroup) => {
        const { type, fields } = formGroup;

        if (type === 'Date') {
          validationTemp[formGroup.name] = Yup.object().test(formGroup.name, formGroup.name, (_obj) => {
            const dayField = fields.find((f) => f.type === 'Date Day');
            const monthField = fields.find((f) => f.type === 'Date Month');
            const yearField = fields.find((f) => f.type === 'Date Year');

            if (dayField == undefined || monthField == undefined || yearField == undefined) {
              return true;
            }
            const day = formValues[dayField.name];
            const month = formValues[monthField.name];
            const year = formValues[yearField.name];

            if (day == undefined || month == undefined || year == undefined) {
              // fields are all required, so we'll only validate the group once they all have values
              return true;
            }
            const dateString = yupDateTransform({ day, month, year });
            if (!yupFHIRDateRegex.test(dateString)) {
              return new Yup.ValidationError(DATE_ERROR_MESSAGE, dateString, formGroup.name, 'matches');
            }
            const now = DateTime.now();
            const dob = DateTime.fromISO(dateString);
            if (dob > now) {
              return new Yup.ValidationError('Date may not be in the future', dateString, formGroup.name);
            }
            return true;
          });
        }
      });
      setValidation(validationTemp);
    }, [flattenedElements, formElements, formValues, groups, methods]);

    const values = methods.watch();
    React.useEffect(() => {
      if (JSON.stringify(values) !== JSON.stringify(formValues)) {
        // console.log('setting values', values);
        setFormValues(values);
        onFormValuesChange && onFormValuesChange(values);
      }
    }, [formValues, values, onFormValuesChange]);

    const createSubmitHandler = (): any => {
      const callback =
        onSubmit &&
        methods.handleSubmit((...args) => {
          onSubmit(...args);
          if (innerForm) {
            methods.reset();
          }
        });

      return async (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        await callback?.(e);
      };
    };

    return (
      <FormProvider {...methods}>
        <form onSubmit={createSubmitHandler()} style={{ width: '100%' }}>
          {formElements && (
            <Grid container spacing={1}>
              {filterFormInputFields(formElements, values, methods)}
            </Grid>
          )}
          <div id="page-form-inner-form" />
          {bottomComponent}
          {!hideControls && <ControlButtons {...controlButtons} />}
        </form>
      </FormProvider>
    );
  },
);

export default PageForm;
