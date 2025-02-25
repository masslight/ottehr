import { CircularProgress } from '@mui/material';
import { Box } from '@mui/system';
import { CustomContainer } from './CustomContainer';

export const LoadingScreen = (): JSX.Element => {
  return (
    <CustomContainer title="" description="">
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    </CustomContainer>
  );
};
