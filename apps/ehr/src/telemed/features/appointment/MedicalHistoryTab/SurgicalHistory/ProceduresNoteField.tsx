import React, { FC } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Skeleton, TextField } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { useDebounceNotesField } from '../../../../hooks';
import { dataTestIds } from '../../../../../constants/data-test-ids';

export const ProceduresNoteField: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const methods = useForm({
    defaultValues: {
      text: chartData?.surgicalHistoryNote?.text || '',
    },
  });

  const { control } = methods;
  const { onValueChange } = useDebounceNotesField('surgicalHistoryNote');

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
          data-testid={dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote}
        />
      )}
    />
  );
};

export const ProceduresNoteFieldSkeleton: FC = () => {
  return (
    <Skeleton variant="rounded" width="100%">
      <TextField multiline rows={3} />
    </Skeleton>
  );
};
