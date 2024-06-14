import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';

export const PrescriptionsContainer: FC = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Prescriptions
      </Typography>
      <Typography>To be implemented</Typography>
    </Box>
  );
};
