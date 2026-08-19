import { Box, CircularProgress, TextField, Typography } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';

type ChiefComplaintFieldProps = {
  /** Overrides the label. The Easy Chart note puts the field's name in its section heading instead. */
  label?: string;
  /**
   * Read and write this encounter instead of resolving one from the appointment store — for a page keyed
   * by encounter, where the store is empty and the field would neither load nor save.
   */
  encounterId?: string;
  /** Called after a save lands, for a page that owns its own chart query. */
  onSaved?: () => void;
};

export const ChiefComplaintField: FC<ChiefComplaintFieldProps> = ({
  label = 'Additional Information',
  encounterId,
  onSaved,
}) => {
  const { data: chartDataFields, isFetched: isChartDataFetched } = useChartFields({
    requestedFields: {
      historyOfPresentIllness: {
        _tag: 'history-of-present-illness',
      },
    },
    encounterId,
  });

  const methods = useForm({
    defaultValues: {
      chiefComplaint: chartDataFields?.historyOfPresentIllness?.text || '',
    },
  });

  useEffect(() => {
    if (isChartDataFetched) {
      methods.setValue('chiefComplaint', chartDataFields?.historyOfPresentIllness?.text ?? '');
    }
  }, [chartDataFields?.historyOfPresentIllness?.text, isChartDataFetched, methods]);

  const { control } = methods;

  const {
    onValueChange: onChiefComplaintChange,
    isLoading: isChiefComplaintLoading,
    isChartDataLoading: isChiefComplaintChartDataLoading,
  } = useDebounceNotesField('historyOfPresentIllness', { encounterId, onSaved });

  return (
    <Controller
      name="chiefComplaint"
      control={control}
      render={({ field: { value, onChange } }) => (
        <TextField
          value={value}
          onChange={(e) => {
            onChange(e);
            onChiefComplaintChange(e.target.value, {
              refetchChartDataOnSave: true,
            });
          }}
          disabled={isChiefComplaintChartDataLoading}
          label={label}
          fullWidth
          multiline
          data-testid={dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes}
          InputProps={{
            endAdornment: isChiefComplaintLoading && (
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

interface ChiefComplaintFieldReadOnlyProps {
  label?: string;
  encounterId?: string;
}

export const ChiefComplaintFieldReadOnly: FC<ChiefComplaintFieldReadOnlyProps> = ({
  label = 'Additional information',
  encounterId,
}) => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      historyOfPresentIllness: { _tag: 'history-of-present-illness' },
    },
    encounterId,
  });

  const chiefComplaint = chartFields?.historyOfPresentIllness?.text;

  if (!chiefComplaint) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="subtitle2" color="primary.dark">
        {label}
      </Typography>
      <Typography variant="body2">{chiefComplaint}</Typography>
    </Box>
  );
};
