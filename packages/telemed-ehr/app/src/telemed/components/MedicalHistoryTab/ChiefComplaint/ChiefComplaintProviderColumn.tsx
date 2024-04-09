import { FC, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Box, FormControlLabel, Skeleton, Switch, TextField } from '@mui/material';
import { useAppointmentStore } from '../../../state';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useDebounceNotesField } from '../../../hooks';

export const ChiefComplaintProviderColumn: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const methods = useForm({
    defaultValues: {
      chiefComplaint: chartData?.chiefComplaint?.description || '',
      ros: chartData?.ros?.description || '',
    },
  });

  const { control, setValue, getValues } = methods;

  const [isROSChecked, setIsROSChecked] = useState(!!chartData?.ros?.description);
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
