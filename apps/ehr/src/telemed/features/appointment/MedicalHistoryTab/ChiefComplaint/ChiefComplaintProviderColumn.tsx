import { Box, CircularProgress, FormControlLabel, Skeleton, Switch, TextField, Typography } from '@mui/material';
import { FC } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useDebounceNotesField } from '../../../../hooks';
import { useAppointmentStore } from '../../../../state';

export const ChiefComplaintProviderColumn: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const methods = useForm({
    defaultValues: {
      chiefComplaint: chartData?.chiefComplaint?.text || '',
      ros: chartData?.ros?.text || '',
    },
  });

  const { control } = methods;

  const {
    onValueChange: onChiefComplaintChange,
    isLoading: isChiefComplaintLoading,
    isChartDataLoading: isChiefComplaintChartDataLoading,
  } = useDebounceNotesField('chiefComplaint');
  const {
    onValueChange: onRosChange,
    isLoading: isRosLoading,
    isChartDataLoading: isRosChartDataLoading,
  } = useDebounceNotesField('ros');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Controller
        name="chiefComplaint"
        control={control}
        render={({ field: { value, onChange } }) => (
          <TextField
            value={value}
            onChange={(e) => {
              onChange(e);
              onChiefComplaintChange(e.target.value);
            }}
            disabled={isChiefComplaintChartDataLoading}
            label="HPI provider notes"
            fullWidth
            multiline
            rows={3}
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
            label="ROS (optional)"
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
    </Box>
  );
};

export const ChiefComplaintProviderColumnReadOnly: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const chiefComplaint = chartData?.chiefComplaint?.text;
  const ros = chartData?.ros?.text;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {chiefComplaint && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="subtitle2" color="primary.dark">
            HPI provider notes
          </Typography>
          <Typography>{chiefComplaint}</Typography>
        </Box>
      )}

      {ros && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="subtitle2" color="primary.dark">
            ROS provider notes
          </Typography>
          <Typography>{ros}</Typography>
        </Box>
      )}
    </Box>
  );
};

export const ChiefComplaintProviderColumnSkeleton: FC = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Skeleton variant="rounded" width="100%">
        <TextField multiline rows={3} />
      </Skeleton>
      <Skeleton variant="rounded">
        <FormControlLabel control={<Switch />} label="Add ROS" />
      </Skeleton>
    </Box>
  );
};
