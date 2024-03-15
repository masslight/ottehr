import React, { FC } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Skeleton, TextField } from '@mui/material';
import { useAppointmentStore } from '../../../state';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useDebounceNotesField } from '../../../hooks';

export const AdditionalQuestionsProviderColumn: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData', 'setPartialChartData']);
  const methods = useForm({
    defaultValues: {
      text: chartData?.observations?.text || '',
    },
  });

  const { control } = methods;
  const { onValueChange } = useDebounceNotesField('observations');

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
