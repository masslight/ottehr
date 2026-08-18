import { Box, CircularProgress, TextField, Typography } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';

type HistoryOfPresentIllnessFieldProps = {
  label?: string;
  /**
   * Read and write this encounter instead of resolving one from the appointment store — for a page keyed
   * by encounter, where the store is empty and the field would neither load nor save.
   */
  encounterId?: string;
  /** Called after a save lands, for a page that owns its own chart query. */
  onSaved?: () => void;
};

export const HistoryOfPresentIllnessField: FC<HistoryOfPresentIllnessFieldProps> = ({
  label = 'History of Present Illness',
  encounterId,
  onSaved,
}) => {
  const { data: chartDataFields } = useChartFields({
    requestedFields: {
      chiefComplaint: {
        _tag: 'chief-complaint',
      },
    },
    encounterId,
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

  const { onValueChange, isLoading, isChartDataLoading } = useDebounceNotesField('chiefComplaint', {
    encounterId,
    onSaved,
  });

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
  encounterId,
}) => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      chiefComplaint: { _tag: 'chief-complaint' },
    },
    encounterId,
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
