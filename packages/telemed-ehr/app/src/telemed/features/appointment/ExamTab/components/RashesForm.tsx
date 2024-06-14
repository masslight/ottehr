import React, { FC, useState } from 'react';
import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';
import { otherColors } from '../../../../../CustomThemeProvider';
import { ExamObservationDTO } from 'ehr-utils';
import { useExamObservations } from '../../../../hooks/useExamObservations';
import { ActionsList, DeleteIconButton, RoundedButton } from '../../../../components';
import { parseRashesFieldToName, rashesFields, rashesOptions } from '../../../../utils';

type FormValues = {
  rashes: string | null;
  description: string;
};

export const RashesForm: FC = () => {
  const { value: fields, update, isLoading } = useExamObservations(rashesFields);
  const abnormalFields = fields.filter((field) => field.value);

  const [value, setValue] = useState(abnormalFields.length > 0);
  const [savedFields, setSavedFields] = useState<ExamObservationDTO[]>([]);

  const methods = useForm<FormValues>({
    defaultValues: {
      rashes: null,
      description: '',
    },
  });
  const { control, handleSubmit, reset } = methods;

  const onAdd = (data: FormValues): void => {
    const field = fields.find((field) => field.field === data.rashes)!;

    update({ ...field, value: true, note: data.description || undefined });

    reset();
  };

  const onRemove = (name: string): void => {
    const field = fields.find((field) => field.field === name)!;

    update({ ...field, value: false });
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
        update(abnormalFields.map((field) => ({ ...field, value: false, note: undefined })));
      }
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <StatelessExamCheckbox abnormal label="Rashes" checked={value} onChange={onBooleanChange} disabled={isLoading} />

      {abnormalFields.length > 0 && (
        <Box sx={{ width: '100%' }}>
          <ActionsList
            data={abnormalFields}
            getKey={(value) => value.field}
            renderItem={(value) => <Typography>{parseRashesFieldToName(value.field, fields)}</Typography>}
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
            <Controller
              name="rashes"
              control={control}
              rules={{
                required: true,
              }}
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Autocomplete
                  options={Object.keys(rashesOptions)}
                  getOptionLabel={(option) => rashesOptions[option as keyof typeof rashesOptions]}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      helperText={error ? error.message : null}
                      error={!!error}
                      size="small"
                      label="Rashes"
                    />
                  )}
                  onChange={(_e, data) => onChange(data)}
                  value={value}
                />
              )}
            />
            <Controller
              name="description"
              control={control}
              rules={{
                required: true,
              }}
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <TextField
                  helperText={error ? error.message : null}
                  error={!!error}
                  size="small"
                  label="Description"
                  value={value}
                  onChange={onChange}
                  multiline
                />
              )}
            />
            <RoundedButton onClick={handleSubmit(onAdd)} disabled={isLoading}>
              Add
            </RoundedButton>
          </Box>
        </FormProvider>
      )}
    </Box>
  );
};
