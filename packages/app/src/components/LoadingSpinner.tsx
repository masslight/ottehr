import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { FC } from 'react';
import { otherColors } from '../OttehrThemeProvider';

export const LoadingSpinner: FC = () => {
  return (
    <Box
      sx={{
        alignItems: 'center',
        backgroundColor: otherColors.blackTransparent,
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
