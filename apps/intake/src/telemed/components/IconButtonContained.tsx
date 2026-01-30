import { alpha, IconButton, styled } from '@mui/material';
import { palette } from '@theme/colors';
import { otherColors } from '../../IntakeThemeProvider';

export const IconButtonContained = styled(IconButton)<{ variant?: string }>(({ variant }) => {
  let colors = {};

  switch (variant) {
    case 'disabled': {
      colors = {
        backgroundColor: palette.primary.main,
        '&:hover': { backgroundColor: alpha(palette.primary.main, 0.5) },
      };
      break;
    }
    case 'error': {
      colors = {
        backgroundColor: otherColors.clearImage,
        '&:hover': { backgroundColor: alpha(otherColors.clearImage, 0.9) },
      };
      break;
    }
    default: {
      colors = {
        backgroundColor: palette.primary.main,
        '&:hover': { backgroundColor: alpha(palette.primary.main, 0.5) },
      };
      break;
    }
  }

  return {
    ...colors,
    width: '36px',
    height: '36px',
  };
});
