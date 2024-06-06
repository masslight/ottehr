import React, { FC } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Skeleton, TextField } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { useDebounceNotesField } from '../../../../hooks';

export const AdditionalQuestionsProviderColumn: FC = () => {
  const { chartData, isReadOnly } = getSelectors(useAppointmentStore, ['chartData', 'isReadOnly']);
  const methods = useForm({
    defaultValues: {
      text: chartData?.observations?.text || '',
    },
  });

  const { control } = methods;
  const { onValueChange } = useDebounceNotesField('observations');

  if (isReadOnly) {
    return null;
  }

  return (
    <Controller
      name="text"
      control={control}
      render={({ field: { value, onChange } }) => (
        <TextField
          value={value}
          onChange={(e) => {
            onChange(e);
            onValueChange(e.target.value);
          }}
          label="Provider notes"
          fullWidth
          multiline
          rows={3}
        />
      )}
    />
  );
};

export const AdditionalQuestionsProviderColumnSkeleton: FC = () => {
  return (
    <Skeleton variant="rounded" width="100%">
      <TextField multiline rows={3} />
    </Skeleton>
  );
};
