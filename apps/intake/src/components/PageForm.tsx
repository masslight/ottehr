import { yupResolver } from '@hookform/resolvers/yup';
import { Grid } from '@mui/material';
import { DateTime } from 'luxon';
import React, { memo, ReactElement, useMemo, useRef } from 'react';
import { FieldValues, FormProvider, FormState, SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  checkEnable,
  DATE_ERROR_MESSAGE,
  decimalRegex,
  emailRegex,
  emojiRegex,
  isoDateRegex,
  phoneRegex,
  yupDateTransform,
  zipRegex,
} from 'utils';
import * as Yup from 'yup';
import { PageFormContext } from '../contexts';
import { filterFormInputFields } from '../helpers/form';
import { ControlButtonsProps, FormInputType, FormInputTypeField, FormInputTypeGroup, OverrideValues } from '../types';
import { ControlButtons } from './form';

export const PAGE_FORM_INNER_FORM_ID = 'page-form-inner-form';

interface PageFormProps {
  formElements?: FormInputType[];
  onSubmit?: SubmitHandler<FieldValues>;
  controlButtons?: ControlButtonsProps;
  bottomComponent?: ReactElement;
  onFormValuesChange?: (values: FieldValues, setValue: (name: string, value: any) => void) => void;
  hideControls?: boolean;
  innerForm?: boolean;
  overrideValues?: OverrideValues;
  onFormStateChange?: (formState: FormState<FieldValues>) => void;
}

const PageForm: React.FC<PageFormProps> = memo(
  ({
    formElements,
    onSubmit,
    controlButtons,
    bottomComponent,
    onFormValuesChange,
    hideControls,
    innerForm,
    overrideValues,
    onFormStateChange,
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
    const { t } = useTranslation();

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
          formInput.validationRegexError = t('pageFormsErrors.numberFormat');
          formInput.mask = '(000) 000-0000';
        }
        if (formInput.format === 'Decimal') {
          formInput.placeholder = '0.0';
          formInput.validationRegex = decimalRegex;
          formInput.validationRegexError = t('pageFormsErrors.moreThanZero');
        }

        if (formInput.format === 'Email') {
          formInput.placeholder = t('aboutPatient.email.placeholder');
          formInput.validationRegex = emailRegex;
          formInput.validationRegexError = t('aboutPatient.email.error');
        }

        if (formInput.format === 'ZIP') {
          formInput.validationRegex = zipRegex;
          formInput.validationRegexError = t('pageFormsErrors.zipCode');
        }

        if (formInput.format === 'Signature') {
          formInput.placeholder = t('pageFormsErrors.fullName');
        }

        if (formInput.type === 'Free Select') {
          validationTemp[formInput.name] =
            formInput.freeSelectMultiple || formInput.freeSelectMultiple == null
              ? Yup.array()
                  .when('$required', (_required, schema) => {
                    return formInput.required ? schema.min(1, `${formInput.label} is required`) : schema;
                  })
                  .test('char-limit', `Input cannot be more than ${formInput.characterLimit} characters`, (inputs) => {
                    return formInput.characterLimit
                      ? (inputs ?? []).join(', ').length <= formInput.characterLimit
                      : true;
                  })
                  .test('no-emoji', 'Emojis are not a valid character', (inputs) => {
                    return emojiRegex.test((inputs ?? []).join(''));
                  })
              : Yup.string()
                  .when('$required', (_required, schema) => {
                    return formInput.required ? schema.min(1, `${formInput.label} is required`) : schema;
                  })
                  .test('char-limit', `Input cannot be more than ${formInput.characterLimit} characters`, (inputs) => {
                    return formInput.characterLimit ? (inputs ?? '').length <= formInput.characterLimit : true;
                  })
                  .test('no-emoji', 'Emojis are not a valid character', (inputs) => {
                    return emojiRegex.test(inputs ?? '');
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
        } else if (formInput.type === 'Photos') {
          validationTemp[formInput.name] = Yup.object().when('$required', (_required, schema) => {
            return formInput.required ? schema.required(`At least one record is required`) : schema;
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
                let modifiedSchema = schema
                  .transform((value: string) => value.trim())
                  .matches(emojiRegex, {
                    message: t('pageFormsErrors.emojis'),
                    excludeEmptyString: true,
                  });
                if (formInput?.maxCharacters?.totalCharacters) {
                  modifiedSchema = modifiedSchema.max(
                    formInput.maxCharacters.totalCharacters,
                    `Please limit your response to ${formInput.maxCharacters.totalCharacters} characters`
                  );
                }
                return modifiedSchema;
              } else if (formInput.type === 'Date') {
                let modifiedSchema = schema
                  .transform(yupDateTransform)
                  .typeError(DATE_ERROR_MESSAGE)
                  .matches(isoDateRegex, DATE_ERROR_MESSAGE)
                  .test((str: any) => {
                    const provided = DateTime.fromISO(str);
                    const now = DateTime.now();
                    if (provided > now) {
                      return new Yup.ValidationError(t('pageFormsErrors.futureDate'), str, formInput.name);
                    }
                    return true;
                  });
                if (formInput.required) {
                  modifiedSchema = modifiedSchema.required(DATE_ERROR_MESSAGE);
                }
                return modifiedSchema;
              } else {
                return schema;
              }
            })
            .when('$required', (_required, schema) => {
              return formInput.required
                ? schema.required(`${formInput.label} ${t('pageFormsErrors.inputRequired')}`)
                : schema;
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
            if (!isoDateRegex.test(dateString)) {
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
    }, [flattenedElements, formElements, formValues, groups, methods, t]);

    const values = methods.watch();
    const { setValue } = methods;

    React.useEffect(() => {
      if (onFormStateChange) {
        onFormStateChange(methods.formState);
      }
    }, [methods.formState, onFormStateChange]);

    React.useEffect(() => {
      if (values['responsible-party-relationship'] !== formValues['responsible-party-relationship'] && overrideValues) {
        if (values['responsible-party-relationship'] === 'Self') {
          setValue('responsible-party-first-name', overrideValues['patient-first-name']);
          setValue('responsible-party-last-name', overrideValues['patient-last-name']);
          setValue('responsible-party-date-of-birth', overrideValues['patient-dob']);
          setValue('responsible-party-birth-sex', overrideValues['patient-birth-sex']);
          setValue('responsible-party-number', overrideValues['account-phone-number']);
        } else if (formValues['responsible-party-relationship'] === 'Self') {
          setValue('responsible-party-first-name', '');
          setValue('responsible-party-last-name', '');
          setValue('responsible-party-date-of-birth', '--');
          setValue('responsible-party-birth-sex', '');
          setValue('responsible-party-number', '');
        }
      } else if (overrideValues) {
        Object.keys(overrideValues).forEach((key) => {
          if (values[key] !== overrideValues[key]) {
            setValue(key, overrideValues[key]);
          }
        });
      }

      if (JSON.stringify(values) !== JSON.stringify(formValues)) {
        setFormValues(values);
        onFormValuesChange && onFormValuesChange(values, setValue);
      }
    }, [formValues, values, onFormValuesChange, setValue, overrideValues]);

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

    const formRef = useRef<HTMLFormElement | null>(null);

    return (
      <PageFormContext.Provider value={{ formRef }}>
        <FormProvider {...methods}>
          <form onSubmit={createSubmitHandler()} style={{ width: '100%' }} ref={formRef}>
            {formElements && (
              <Grid container spacing={1}>
                {filterFormInputFields(formElements, values, methods, overrideValues)}
              </Grid>
            )}
            <div id={PAGE_FORM_INNER_FORM_ID} />
            {bottomComponent}
            {!hideControls && <ControlButtons {...controlButtons} />}
          </form>
        </FormProvider>
      </PageFormContext.Provider>
    );
  }
);

export default PageForm;
