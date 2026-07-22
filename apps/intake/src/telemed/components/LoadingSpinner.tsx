import { Box, useTheme } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { FC, useContext } from 'react';
import { IntakeThemeContext } from '../../contexts';

interface LoadingSpinnerProps {
  transparent?: boolean;
  // Render the spinner white for use over dark backgrounds (e.g. the video-call screen), where the default
  // primary (blue) spinner is invisible against the dark-blue background.
  white?: boolean;
}
export const LoadingSpinner: FC<LoadingSpinnerProps> = ({ transparent, white }) => {
  const { otherColors } = useContext(IntakeThemeContext);
  const theme = useTheme();
  return (
    <Box
      sx={{
        alignItems: 'center',
        backgroundColor: transparent ? otherColors.blackTransparent : theme.palette.background.paper,
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
      <CircularProgress sx={white ? { color: '#fff' } : undefined} />
    </Box>
  );
};
