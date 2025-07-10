import { otherColors } from '@ehrTheme/colors';
import { Box, useTheme } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { FC } from 'react';
import { dataTestIds } from '../../constants/data-test-ids';

interface LoadingSpinnerProps {
  transparent?: boolean;
}
export const LoadingSpinner: FC<LoadingSpinnerProps> = ({ transparent }) => {
  const theme = useTheme();
  return (
    <Box
      data-testid={dataTestIds.loadingSpinner}
      sx={{
        alignItems: 'center',
        backgroundColor: transparent ? otherColors.blackTransparent : theme.palette.background.default,
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
