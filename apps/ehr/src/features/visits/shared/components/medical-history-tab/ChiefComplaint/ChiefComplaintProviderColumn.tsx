import { Box, FormControlLabel, Skeleton, Switch, TextField } from '@mui/material';
import { FC } from 'react';
import { ChiefComplaintField, ChiefComplaintFieldReadOnly } from '../../../../ChiefComplaintField';
import { RosField, RosFieldReadOnly } from '../../../../RosField';

export const ChiefComplaintProviderColumn: FC = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <ChiefComplaintField />

    <RosField />
  </Box>
);

export const ChiefComplaintProviderColumnReadOnly: FC = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
    <ChiefComplaintFieldReadOnly />

    <RosFieldReadOnly />
  </Box>
);

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
