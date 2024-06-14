import { Box, FormControlLabel, Skeleton, Switch, TextField, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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

  const { control, setValue, getValues } = methods;

  const [isROSChecked, setIsROSChecked] = useState(!!chartData?.ros?.text);
  const { onValueChange: onChiefComplaintChange } = useDebounceNotesField('chiefComplaint');
  const { onValueChange: onRosChange } = useDebounceNotesField('ros');

  const onSwitchChange = (value: boolean): void => {
    setIsROSChecked(value);

    const rosValue = getValues('ros');
    if (!value && rosValue !== '') {
      setValue('ros', '');
      onRosChange('');
    }
  };

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
            label="HPI provider notes"
            fullWidth
            multiline
            rows={3}
          />
        )}
      />

      <FormControlLabel
        control={<Switch checked={isROSChecked} onChange={(event) => onSwitchChange(event.target.checked)} />}
        label="Add ROS"
      />

      {isROSChecked && (
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
              label="ROS provider notes"
              fullWidth
              multiline
              rows={3}
            />
          )}
        />
      )}
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
