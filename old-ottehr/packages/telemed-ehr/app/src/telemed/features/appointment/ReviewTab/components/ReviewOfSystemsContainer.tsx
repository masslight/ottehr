import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const ReviewOfSystemsContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const ros = chartData?.ros?.text;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Review of systems
      </Typography>
      {ros ? (
        <Typography>{ros}</Typography>
      ) : (
        <Typography color="secondary.light">No review of systems provided</Typography>
      )}
    </Box>
  );
};
