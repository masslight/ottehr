import { Box, CircularProgress, TextField, Typography } from '@mui/material';
import { FC } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';
import { useSyncServerNoteToField } from './shared/hooks/useSyncServerNoteToField';

type HistoryOfPresentIllnessFieldProps = {
  label?: string;
};

export const HistoryOfPresentIllnessField: FC<HistoryOfPresentIllnessFieldProps> = ({
  label = 'History of Present Illness',
}) => {
  const { data: chartDataFields } = useChartFields({
    requestedFields: {
      chiefComplaint: {
        _tag: 'chief-complaint',
      },
    },
  });

  const methods = useForm({
    defaultValues: {
      historyOfPresentIllness: chartDataFields?.chiefComplaint?.text || '',
    },
  });

  useSyncServerNoteToField({
    serverValue: chartDataFields?.chiefComplaint?.text,
    getFieldValue: () => methods.getValues('historyOfPresentIllness'),
    setFieldValue: (value) => methods.setValue('historyOfPresentIllness', value),
  });

  const { control } = methods;

  const { onValueChange, isLoading, isChartDataLoading } = useDebounceNotesField('chiefComplaint');

  return (
    <Controller
      name="historyOfPresentIllness"
      control={control}
      render={({ field: { value, onChange } }) => (
        <TextField
          value={value}
          onChange={(e) => {
            onChange(e);
            onValueChange(e.target.value, {
              refetchChartDataOnSave: true,
            });
          }}
          disabled={isChartDataLoading}
          label={label}
          fullWidth
          multiline
          data-testid={dataTestIds.hpiAndTemplatesPage.hpiNotes}
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
  );
};

export const HistoryOfPresentIllnessFieldReadOnly: FC<HistoryOfPresentIllnessFieldProps> = ({
  label = 'History of Present Illness',
}) => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      chiefComplaint: { _tag: 'chief-complaint' },
    },
  });

  const historyOfPresentIllness = chartFields?.chiefComplaint?.text;

  if (!historyOfPresentIllness) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="subtitle2" color="primary.dark">
        {label}
      </Typography>
      <Typography variant="body2">{historyOfPresentIllness}</Typography>
    </Box>
  );
};
