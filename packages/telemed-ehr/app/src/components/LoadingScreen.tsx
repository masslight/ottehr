import { Box, CircularProgress } from '@mui/material';
import { FC } from 'react';

export const LoadingScreen: FC = () => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
      }}
    >
      <CircularProgress />
    </Box>
  );
};
