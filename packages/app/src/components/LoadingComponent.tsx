import { Box, CircularProgress } from '@mui/material';
import { CustomContainer } from './CustomContainer';

type LoadingComponentProps = {
  height?: number;
};

export function LoadingComponent({ height }: LoadingComponentProps): JSX.Element {
  return (
    <CustomContainer title="Loading...">
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          height: height != null ? height : 500,
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    </CustomContainer>
  );
}
