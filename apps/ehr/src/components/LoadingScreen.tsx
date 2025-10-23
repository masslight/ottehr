import { Box, CircularProgress } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

export const LoadingScreen: FC = () => {
  return (
    <Box
      data-testid={dataTestIds.loadingScreen}
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
