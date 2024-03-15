import CircularProgress from '@mui/material/CircularProgress';
import { FC } from 'react';
import { useTheme, Box } from '@mui/material';
import { otherColors } from '../../CustomThemeProvider';

interface LoadingSpinnerProps {
  transparent?: boolean;
}
export const LoadingSpinner: FC<LoadingSpinnerProps> = ({ transparent }) => {
  const theme = useTheme();
  return (
    <Box
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
