import { Box, CircularProgress, TextField, Typography } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';

export const ChiefComplaintField: FC = () => {
  const { data: chartDataFields } = useChartFields({
    requestedFields: {
      chiefComplaint: {
        _tag: 'chief-complaint',
      },
    },
  });

  const methods = useForm({
    defaultValues: {
      chiefComplaint: chartDataFields?.chiefComplaint?.text || '',
    },
  });

  useEffect(() => {
    if (chartDataFields?.chiefComplaint?.text !== undefined) {
      methods.setValue('chiefComplaint', chartDataFields.chiefComplaint.text);
    }
  }, [chartDataFields?.chiefComplaint?.text, methods]);

  const { control } = methods;

  const {
    onValueChange: onChiefComplaintChange,
    isLoading: isChiefComplaintLoading,
    isChartDataLoading: isChiefComplaintChartDataLoading,
  } = useDebounceNotesField('chiefComplaint');

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
              additionalRequestOptions: { createICDRecommendations: true },
            });
          }}
          disabled={isChiefComplaintChartDataLoading}
          label="Chief Complaint"
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
}

export const ChiefComplaintFieldReadOnly: FC<ChiefComplaintFieldReadOnlyProps> = ({ label = 'Chief Complaint' }) => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      chiefComplaint: { _tag: 'chief-complaint' },
    },
  });

  const chiefComplaint = chartFields?.chiefComplaint?.text;

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
