import { Box, CircularProgress, Skeleton, TextField, Typography } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useDebounceNotesField, useGetAppointmentAccessibility } from '../../../../hooks';
import { useAppointmentStore } from '../../../../state';

export const ProceduresNoteField: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const methods = useForm({
    defaultValues: {
      text: chartData?.surgicalHistoryNote?.text || '',
    },
  });

  useEffect(() => {
    const currentValue = methods.getValues('text');
    const newValue = chartData?.surgicalHistoryNote?.text;

    if (!currentValue && newValue) {
      methods.setValue('text', newValue);
    }
  }, [chartData?.surgicalHistoryNote?.text, methods]);

  const { control } = methods;
  const { onValueChange, isChartDataLoading, isLoading } = useDebounceNotesField('surgicalHistoryNote');

  if (isReadOnly && !chartData?.surgicalHistoryNote?.text) {
    return null;
  }

  return !isReadOnly ? (
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
          disabled={isChartDataLoading}
          InputProps={{
            endAdornment: isLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size="20px" />
              </Box>
            ),
          }}
        />
      )}
    />
  ) : (
    <Typography>{chartData?.surgicalHistoryNote?.text}</Typography>
  );
};

export const ProceduresNoteFieldSkeleton: FC = () => {
  return (
    <Skeleton variant="rounded" width="100%">
      <TextField multiline rows={3} />
    </Skeleton>
  );
};
