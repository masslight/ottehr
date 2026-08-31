import { Box, CircularProgress } from '@mui/material';
import { FC } from 'react';

export const LoadingScreen: FC = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);
