import { otherColors } from '@ehrTheme/colors';
import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import React, { FC, useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { ExamObservationDTO } from 'utils';
import { parseRashesFieldToName, rashesFields, rashesOptions } from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { ActionsList, DeleteIconButton } from '../../../../components';
import { useExamObservations } from '../../../../hooks/useExamObservations';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

type FormValues = {
  rashes: string | null;
  description: string;
};

export const RashesForm: FC = () => {
  const { value: fields, update, isLoading } = useExamObservations(rashesFields);

  const {
    value: noRashesField,
    update: updateNoRashes,
    isLoading: isNoRashesLoading,
  } = useExamObservations('no-rashes');

  const abnormalFields = fields.filter((field) => field.value);

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

  useEffect(() => {
    if (!noRashesField.value) {
      if (savedFields.length > 0) {
        update(savedFields.map((field) => ({ ...field, value: true })));
      }
    } else {
      if (abnormalFields.length > 0) {
        setSavedFields(abnormalFields);
        update(abnormalFields.map((field) => ({ ...field, value: false, note: undefined })));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noRashesField.value]);

  const onBooleanChange = (value: boolean): void => {
    updateNoRashes({ ...noRashesField, value: !value });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Box data-testid={dataTestIds.telemedEhrFlow.examTabRashesCheckbox}>
        <StatelessExamCheckbox
          abnormal
          label="Rashes"
          checked={!noRashesField.value}
          onChange={onBooleanChange}
          disabled={isNoRashesLoading}
        />
      </Box>

      {abnormalFields.length > 0 && (
        <Box sx={{ width: '100%' }} data-testid={dataTestIds.telemedEhrFlow.examTabRashesAbnormalSubsection}>
          <ActionsList
            data={abnormalFields}
            getKey={(value) => value.field}
            itemDataTestId={dataTestIds.telemedEhrFlow.examTabRashElementInSubsection}
            renderItem={(value) => <Typography>{parseRashesFieldToName(value.field, fields)}</Typography>}
            renderActions={(value) => <DeleteIconButton disabled={isLoading} onClick={() => onRemove(value.field)} />}
            divider
            gap={0.5}
          />
        </Box>
      )}

      {!noRashesField.value && (
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
                  data-testid={dataTestIds.telemedEhrFlow.examTabRashesDropdown}
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
                required: false,
              }}
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <TextField
                  helperText={error ? error.message : null}
                  data-testid={dataTestIds.telemedEhrFlow.examTabRashesDescription}
                  error={!!error}
                  size="small"
                  label="Description"
                  value={value}
                  onChange={onChange}
                  multiline
                />
              )}
            />
            <RoundedButton
              onClick={handleSubmit(onAdd)}
              disabled={isLoading}
              data-testid={dataTestIds.telemedEhrFlow.examTabRashesAddButton}
            >
              Add
            </RoundedButton>
          </Box>
        </FormProvider>
      )}
    </Box>
  );
};
