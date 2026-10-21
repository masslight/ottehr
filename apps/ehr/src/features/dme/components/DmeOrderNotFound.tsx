import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import React from 'react';

export const DmeOrderLoading: React.FC = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
    <CircularProgress />
  </Box>
);

export const DmeOrderNotFound: React.FC<{ failed?: boolean; onBack: () => void }> = ({ failed, onBack }) => (
  <Stack spacing={2} sx={{ p: 3, alignItems: 'flex-start' }}>
    <Typography variant="h6">{failed ? 'Failed to load the DME order.' : 'DME order not found.'}</Typography>
    <Button variant="outlined" onClick={onBack} sx={{ borderRadius: '50px', textTransform: 'none' }}>
      Back
    </Button>
  </Stack>
);
