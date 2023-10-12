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
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: height != null ? height : 500,
        }}
      >
        <CircularProgress />
      </Box>
    </CustomContainer>
  );
}
