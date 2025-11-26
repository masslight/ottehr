import { Box, CircularProgress, TextField, Typography } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';

export const RosField: FC = () => {
  const { data: chartDataFields } = useChartFields({
    requestedFields: {
      ros: { _tag: 'ros' },
    },
  });

  const methods = useForm({
    defaultValues: {
      ros: chartDataFields?.ros?.text || '',
    },
  });

  useEffect(() => {
    if (chartDataFields?.ros?.text !== undefined) {
      methods.setValue('ros', chartDataFields.ros.text);
    }
  }, [chartDataFields?.ros?.text, methods]);

  const { control } = methods;

  const {
    onValueChange: onRosChange,
    isLoading: isRosLoading,
    isChartDataLoading: isRosChartDataLoading,
  } = useDebounceNotesField('ros');

  return (
    <Controller
      name="ros"
      control={control}
      render={({ field: { value, onChange } }) => (
        <TextField
          value={value}
          onChange={(e) => {
            onChange(e);
            onRosChange(e.target.value);
          }}
          disabled={isRosChartDataLoading}
          label="ROS (Optional)"
          fullWidth
          multiline
          data-testid={dataTestIds.telemedEhrFlow.hpiChiefComplaintRos}
          InputProps={{
            endAdornment: isRosLoading && (
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

export const RosFieldReadOnly: FC = () => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      ros: { _tag: 'ros' },
    },
  });

  const ros = chartFields?.ros?.text;

  if (!ros) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="subtitle2" color="primary.dark">
        ROS provider notes
      </Typography>
      <Typography variant="body2">{ros}</Typography>
    </Box>
  );
};
