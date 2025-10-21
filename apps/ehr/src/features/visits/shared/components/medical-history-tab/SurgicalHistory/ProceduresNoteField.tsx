import { Box, CircularProgress, Skeleton, TextField, Typography } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from '../../../hooks/useChartFields';
import { useDebounceNotesField } from '../../../hooks/useDebounceNotesField';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';

export const ProceduresNoteField: FC = () => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      surgicalHistoryNote: {
        _tag: 'surgical-history-note',
      },
    },
  });

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const methods = useForm({
    defaultValues: {
      text: chartFields?.surgicalHistoryNote?.text || '',
    },
  });

  useEffect(() => {
    const currentValue = methods.getValues('text');
    const newValue = chartFields?.surgicalHistoryNote?.text;

    if (!currentValue && newValue) {
      methods.setValue('text', newValue);
    }
  }, [chartFields?.surgicalHistoryNote?.text, methods]);

  const { control } = methods;
  const { onValueChange, isChartDataLoading, isLoading } = useDebounceNotesField('surgicalHistoryNote');

  if (isReadOnly && !chartFields?.surgicalHistoryNote?.text) {
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
    <Typography>{chartFields?.surgicalHistoryNote?.text}</Typography>
  );
};

export const ProceduresNoteFieldSkeleton: FC = () => {
  return (
    <Skeleton variant="rounded" width="100%">
      <TextField multiline rows={3} />
    </Skeleton>
  );
};
