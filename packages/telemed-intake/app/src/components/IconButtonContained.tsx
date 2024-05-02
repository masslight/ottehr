import { IconButton, styled, alpha } from '@mui/material';
import { otherColors } from '../IntakeThemeProvider';

export const IconButtonContained = styled(IconButton)<{ variant?: string }>(({ variant }) => {
  let colors = {};

  switch (variant) {
    case 'disabled': {
      colors = {
        backgroundColor: otherColors.white,
        '&:hover': { backgroundColor: alpha(otherColors.white, 0.9) },
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
        backgroundColor: alpha(otherColors.coachingVisit, 0.2),
        '&:hover': { backgroundColor: alpha(otherColors.coachingVisit, 0.1) },
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
