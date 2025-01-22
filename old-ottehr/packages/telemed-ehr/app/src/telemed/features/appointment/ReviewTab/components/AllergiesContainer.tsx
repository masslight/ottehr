import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const AllergiesContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const allergies = chartData?.allergies;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Allergies
      </Typography>
      {allergies && allergies.length > 0 ? (
        allergies.map((allergy) => <Typography key={allergy.resourceId}>{allergy.name}</Typography>)
      ) : (
        <Typography color="secondary.light">Patient has no allergies</Typography>
      )}
    </Box>
  );
};
