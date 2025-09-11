import { otherColors } from '@ehrTheme/colors';
import { Autocomplete, Box, FormControlLabel, Radio, RadioGroup, TextField, Typography } from '@mui/material';
import React, { FC, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm, UseFormWatch } from 'react-hook-form';
import { ExamCardFormComponent, ExamObservationDTO } from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { ActionsList, DeleteIconButton } from '../../../../components';
import { useExamObservations } from '../../../../hooks/useExamObservations';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

type FormValues = Record<string, string | null>;

type ExamFormProps = {
  form: ExamCardFormComponent;
  abnormal?: boolean;
};

export const ExamForm: FC<ExamFormProps> = ({ form, abnormal = false }) => {
  const fieldNames = Object.keys(form.fields);
  const observationNames = Object.keys(form.components);

  const dynamicForm = useMemo(() => {
    const formConfig: Record<string, any> = {};

    fieldNames.forEach((fieldName) => {
      const field = form.fields[fieldName];
      if (field.type === 'radio' && field.options) {
        const firstOption = Object.keys(field.options)[0];
        formConfig[fieldName] = firstOption;
      } else {
        formConfig[fieldName] = null;
      }
    });

    return formConfig;
  }, [form.fields, fieldNames]);

  const { value: fields, update, isLoading } = useExamObservations(observationNames);
  const abnormalFields = fields.filter((field) => field.value);

  const [value, setValue] = useState(abnormalFields.length > 0);
  const [savedFields, setSavedFields] = useState<ExamObservationDTO[]>([]);

  const methods = useForm<FormValues>({
    defaultValues: dynamicForm,
  });
  const { control, handleSubmit, watch, reset } = methods;

  const onAdd = (data: FormValues): void => {
    const { fieldNamesModified, notes } = fieldNames
      .filter(
        (fieldName) => !form.fields[fieldName].enabledWhen || isFieldEnabled(form.fields[fieldName].enabledWhen!, watch)
      )
      .reduce(
        (prev, curr) => {
          const value = data[curr];
          if (!value) {
            return prev;
          }

          if (form.fields[curr].type === 'text') {
            prev.notes.push(value);
          } else {
            prev.fieldNamesModified.push(value);
          }
          return prev;
        },
        { fieldNamesModified: [], notes: [] } as { fieldNamesModified: string[]; notes: string[] }
      );

    const fieldName = fieldNamesModified.join('-');
    const field = fields.find((field) => field.field === fieldName);

    const note = notes.join(' | ');

    if (field) {
      update({ ...field, value: true, note });
      reset();
    }
  };

  const onRemove = (name: string): void => {
    const field = fields.find((field) => field.field === name);

    if (field) {
      update({ ...field, note: undefined, value: false });
    }
  };

  const onBooleanChange = (value: boolean): void => {
    setValue(value);

    if (value) {
      if (savedFields.length > 0) {
        update(savedFields.map((field) => ({ ...field, value: true })));
      }
    } else {
      setSavedFields(abnormalFields);
      if (abnormalFields.length > 0) {
        update(abnormalFields.map((field) => ({ ...field, value: false })));
      }
    }
  };

  const renderField = (fieldName: string, field: any): React.ReactNode => {
    if (field.enabledWhen && !isFieldEnabled(field.enabledWhen, watch)) {
      return null;
    }

    if (field.type === 'radio' && field.options) {
      return (
        <Controller
          key={fieldName}
          name={fieldName}
          control={control}
          rules={{ required: true }}
          render={({ field: { onChange, value } }) => (
            <RadioGroup value={value || ''} onChange={onChange} row>
              {Object.entries(field.options).map(([optionValue, option]) => (
                <FormControlLabel
                  key={optionValue}
                  value={optionValue}
                  label={
                    typeof option === 'object' && option !== null && 'label' in option
                      ? (option as { label: string }).label
                      : optionValue
                  }
                  control={<Radio size="small" />}
                />
              ))}
            </RadioGroup>
          )}
        />
      );
    }

    if (field.type === 'dropdown' && field.options) {
      return (
        <Controller
          key={fieldName}
          name={fieldName}
          control={control}
          rules={{ required: true }}
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Autocomplete
              options={Object.keys(field.options)}
              getOptionLabel={(option) => {
                const optionData = field.options[option];
                return typeof optionData === 'object' && optionData !== null && 'label' in optionData
                  ? (optionData as { label: string }).label
                  : option;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  helperText={error ? error.message : null}
                  error={!!error}
                  size="small"
                  label={field.label}
                />
              )}
              onChange={(_e, data) => onChange(data)}
              value={value}
            />
          )}
        />
      );
    }

    if (field.type === 'text') {
      return (
        <Controller
          key={fieldName}
          name={fieldName}
          control={control}
          rules={{ required: false }}
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <TextField
              helperText={error ? error.message : null}
              error={!!error}
              size="small"
              label={field.label}
              value={value || ''}
              onChange={onChange}
              multiline={fieldName.toLowerCase().includes('description')}
            />
          )}
        />
      );
    }

    return null;
  };

  const isFieldEnabled = (enabledWhen: { field: string; value: string }, watch: UseFormWatch<FormValues>): boolean => {
    if (!enabledWhen || !enabledWhen.field) {
      return true;
    }

    const dependentFieldValue = watch(enabledWhen.field);
    return dependentFieldValue === enabledWhen.value;
  };

  const getLabel = (item: ExamObservationDTO): string => {
    const components = item.field.split('-');
    const values = fieldNames
      .filter((fieldName) => form.fields[fieldName].type !== 'text')
      .map((fieldName) => {
        const option = Object.keys(form.fields[fieldName].options || {}).find((optionValue) =>
          components.includes(optionValue)
        );
        return {
          field: fieldName,
          label: option ? form.fields[fieldName].options?.[option]?.label : null,
          value: option,
          enabledWhen: form.fields[fieldName].enabledWhen,
        };
      })
      .filter((component, _index, self) => {
        if (!component.enabledWhen) {
          return true;
        }

        const whenComponent = self.find((c) => c.field === component.enabledWhen?.field);
        return whenComponent?.value === component.enabledWhen?.value;
      });

    return [...values.map((value) => value.label), item.note].filter(Boolean).join(' | ');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <StatelessExamCheckbox
        abnormal={abnormal}
        label={form.label}
        checked={value}
        onChange={onBooleanChange}
        disabled={isLoading}
      />

      {abnormalFields.length > 0 && (
        <Box sx={{ width: '100%' }}>
          <ActionsList
            data={abnormalFields}
            getKey={(value) => value.field}
            renderItem={(value) => <Typography>{getLabel(value)}</Typography>}
            renderActions={(value) => <DeleteIconButton disabled={isLoading} onClick={() => onRemove(value.field)} />}
            divider
            gap={0.5}
          />
        </Box>
      )}

      {value && (
        <FormProvider {...methods}>
          <Box
            sx={{
              p: 2,
              backgroundColor: otherColors.formCardBg,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              borderRadius: 2,
            }}
          >
            {fieldNames.map((fieldName) => {
              const field = form.fields[fieldName];
              return renderField(fieldName, field);
            })}

            <RoundedButton onClick={handleSubmit(onAdd)} disabled={isLoading}>
              Add
            </RoundedButton>
          </Box>
        </FormProvider>
      )}
    </Box>
  );
};
