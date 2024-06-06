import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const MedicalConditionsContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const conditions = chartData?.conditions;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Medical conditions
      </Typography>
      {conditions && conditions.length > 0 ? (
        conditions.map((condition) => (
          <Typography key={condition.resourceId}>
            {condition.display} {condition.code}
          </Typography>
        ))
      ) : (
        <Typography color="secondary.light">Patient has no medical conditions</Typography>
      )}
    </Box>
  );
};
