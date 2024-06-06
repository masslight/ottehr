import React, { FC, useState } from 'react';
import { Autocomplete, Box, FormControlLabel, Radio, RadioGroup, TextField, Typography } from '@mui/material';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { ExamObservationDTO } from 'ehr-utils';
import { useExamObservations } from '../../../../hooks/useExamObservations';
import { ActionsList, DeleteIconButton, RoundedButton } from '../../../../components';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';
import { otherColors } from '../../../../../CustomThemeProvider';
import {
  musculoskeletalFields,
  parseMusculoskeletalFieldToName,
  musculoskeletalSideOptions,
  musculoskeletalBodyPartOptions,
  musculoskeletalFingerOptions,
  musculoskeletalToeOptions,
  musculoskeletalAbnormalOptions,
} from '../../../../utils';

type FormValues = {
  side: string;
  bodyPart: string | null;
  finger: string | null;
  toe: string | null;
  abnormal: string | null;
};

export const MusculoskeletalForm: FC = () => {
  const { value: fields, update, isLoading } = useExamObservations(musculoskeletalFields);
  const abnormalFields = fields.filter((field) => field.value);

  const [value, setValue] = useState(abnormalFields.length > 0);
  const [savedFields, setSavedFields] = useState<ExamObservationDTO[]>([]);

  const methods = useForm<FormValues>({
    defaultValues: {
      side: 'left',
      bodyPart: null,
      finger: null,
      toe: null,
      abnormal: null,
    },
  });
  const { control, handleSubmit, watch, reset } = methods;

  const onAdd = (data: FormValues): void => {
    const arr: string[] = [];

    arr.push(data.abnormal!);
    arr.push(data.side);
    arr.push(data.bodyPart!);

    switch (data.bodyPart) {
      case 'finger':
        arr.push(data.finger!);
        break;
      case 'toe':
        arr.push(data.toe!);
        break;
    }

    const fieldName = arr.join('-');
    const field = fields.find((field) => field.field === fieldName)!;

    update({ ...field, value: true });

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
        update(abnormalFields.map((field) => ({ ...field, value: false })));
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
      <StatelessExamCheckbox
        abnormal
        label="Abnormal"
        checked={value}
        onChange={onBooleanChange}
        disabled={isLoading}
      />

      {abnormalFields.length > 0 && (
        <Box sx={{ width: '100%' }}>
          <ActionsList
            data={abnormalFields}
            getKey={(value) => value.field}
            renderItem={(value) => <Typography>{parseMusculoskeletalFieldToName(value.field)}</Typography>}
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
              name="side"
              control={control}
              rules={{
                required: true,
              }}
              render={({ field: { onChange, value } }) => (
                <RadioGroup value={value} onChange={onChange} row>
                  {musculoskeletalSideOptions.map((singleOption) => (
                    <FormControlLabel
                      key={singleOption.value}
                      value={singleOption.value}
                      label={singleOption.label}
                      control={<Radio size="small" />}
                    />
                  ))}
                </RadioGroup>
              )}
            />
            <Controller
              name="bodyPart"
              control={control}
              rules={{
                required: true,
              }}
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Autocomplete
                  options={Object.keys(musculoskeletalBodyPartOptions)}
                  getOptionLabel={(option) =>
                    musculoskeletalBodyPartOptions[option as keyof typeof musculoskeletalBodyPartOptions]
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      helperText={error ? error.message : null}
                      error={!!error}
                      size="small"
                      label="Body part"
                    />
                  )}
                  onChange={(_e, data) => onChange(data)}
                  value={value}
                />
              )}
            />
            {watch('bodyPart') === 'finger' && (
              <Controller
                name="finger"
                control={control}
                rules={{
                  required: true,
                }}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Autocomplete
                    options={Object.keys(musculoskeletalFingerOptions)}
                    getOptionLabel={(option) =>
                      musculoskeletalFingerOptions[option as keyof typeof musculoskeletalFingerOptions]
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        helperText={error ? error.message : null}
                        error={!!error}
                        size="small"
                        label="Finger"
                      />
                    )}
                    onChange={(_e, data) => onChange(data)}
                    value={value}
                  />
                )}
              />
            )}
            {watch('bodyPart') === 'toe' && (
              <Controller
                name="toe"
                control={control}
                rules={{
                  required: true,
                }}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Autocomplete
                    options={Object.keys(musculoskeletalToeOptions)}
                    getOptionLabel={(option) =>
                      musculoskeletalToeOptions[option as keyof typeof musculoskeletalToeOptions]
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        helperText={error ? error.message : null}
                        error={!!error}
                        size="small"
                        label="Toe"
                      />
                    )}
                    onChange={(_e, data) => onChange(data)}
                    value={value}
                  />
                )}
              />
            )}
            <Controller
              name="abnormal"
              control={control}
              rules={{
                required: true,
              }}
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Autocomplete
                  options={Object.keys(musculoskeletalAbnormalOptions)}
                  getOptionLabel={(option) =>
                    musculoskeletalAbnormalOptions[option as keyof typeof musculoskeletalAbnormalOptions]
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      helperText={error ? error.message : null}
                      error={!!error}
                      size="small"
                      label="Abnormal"
                    />
                  )}
                  onChange={(_e, data) => onChange(data)}
                  value={value}
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
