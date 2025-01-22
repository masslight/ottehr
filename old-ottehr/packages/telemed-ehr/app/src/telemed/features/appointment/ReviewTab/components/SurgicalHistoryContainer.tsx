import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const SurgicalHistoryContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const procedures = chartData?.procedures;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Surgical history
      </Typography>
      {procedures && procedures.length > 0 ? (
        procedures.map((procedure) => <Typography key={procedure.resourceId}>{procedure.name}</Typography>)
      ) : (
        <Typography color="secondary.light">Patient has no surgical history</Typography>
      )}
    </Box>
  );
};
