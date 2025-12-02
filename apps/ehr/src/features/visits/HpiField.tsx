import { Box, CircularProgress, TextField, Typography } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';

export const HistoryOfPresentIllnessField: FC = () => {
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

  useEffect(() => {
    if (chartDataFields?.chiefComplaint?.text !== undefined) {
      methods.setValue('historyOfPresentIllness', chartDataFields.chiefComplaint.text);
    }
  }, [chartDataFields?.chiefComplaint?.text, methods]);

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
          label="History of Present Illness"
          fullWidth
          multiline
          data-testid={dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes}
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

export const HistoryOfPresentIllnessFieldReadOnly: FC = () => {
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
        History of Present Illness
      </Typography>
      <Typography variant="body2">{historyOfPresentIllness}</Typography>
    </Box>
  );
};
