import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { FC } from 'react';

export const LoadingSpinner: FC = () => {
  return (
    <Box
      sx={{
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        height: '100vh',
        justifyContent: 'center',
        left: 0,
        position: 'fixed',
        top: 0,
        width: '100vw',
        zIndex: 9999,
      }}
    >
      <CircularProgress />
    </Box>
  );
};
