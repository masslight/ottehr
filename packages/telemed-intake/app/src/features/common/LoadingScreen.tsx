import { CircularProgress } from '@mui/material';
import { Box } from '@mui/system';
import { IntakeFlowPageRoute } from '../../App';
import { CustomContainer } from './CustomContainer';

export const LoadingScreen = (): JSX.Element => {
  return (
    <CustomContainer title="" description="" bgVariant={IntakeFlowPageRoute.Homepage.path}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    </CustomContainer>
  );
};
