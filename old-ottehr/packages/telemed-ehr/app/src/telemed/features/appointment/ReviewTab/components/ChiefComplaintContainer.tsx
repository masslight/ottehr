import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const ChiefComplaintContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const chiefComplaint = chartData?.chiefComplaint?.text;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Chief complaint & History of Present Illness
      </Typography>
      {chiefComplaint ? (
        <Typography>{chiefComplaint}</Typography>
      ) : (
        <Typography color="secondary.light">No chief complaint provided</Typography>
      )}
      <Typography variant="body2" color="secondary.light">
        Provider spent XX minutes on real-time audio & video with this patient
      </Typography>
    </Box>
  );
};
