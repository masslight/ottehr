import { IconButton, styled, useTheme } from '@mui/material';
import { lighten, SxProps } from '@mui/material/styles';

export type IconButtonContainedVariant =
  | 'error'
  | 'loading'
  | 'primary'
  | 'disabled'
  | 'primary.lighter'
  | 'primary.lightest';

export const IconButtonContained = styled(IconButton)<{ variant?: IconButtonContainedVariant }>(({ variant }) => {
  const theme = useTheme();
  let styles: SxProps = {
    '& > svg': {
      transition: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
  };

  switch (variant) {
    case 'disabled': {
      styles = {
        ...styles,
        backgroundColor: theme.palette.primary.contrastText,
        pointerEvents: 'none',
        cursor: 'default',
        '&:hover': {},
      };
      break;
    }
    case 'error': {
      styles = {
        ...styles,
        backgroundColor: theme.palette.error.main,
        '&:hover': { backgroundColor: lighten(theme.palette.error.main, 0.125) },
      };
      break;
    }
    case 'loading': {
      styles = {
        ...styles,
        backgroundColor: theme.palette.action.disabled,
        '&:hover': { backgroundColor: lighten(theme.palette.primary.main, 0.125) },
      };
      break;
    }
    case 'primary': {
      styles = {
        ...styles,
        backgroundColor: theme.palette.primary.main,
        '&:hover': { backgroundColor: lighten(theme.palette.primary.main, 0.125) },
      };
      break;
    }
    case 'primary.lighter': {
      styles = {
        ...styles,
        backgroundColor: lighten(theme.palette.primary.main, 0.1),
        '&:hover': { backgroundColor: lighten(theme.palette.primary.main, 0.2) },
      };
      break;
    }
    case 'primary.lightest': {
      styles = {
        ...styles,
        backgroundColor: lighten(theme.palette.primary.main, 0.85),
        '&:hover': { backgroundColor: lighten(theme.palette.primary.main, 0.75) },
      };
      break;
    }
    default: {
      styles = {
        ...styles,
        backgroundColor: theme.palette.primary.main,
        '&:hover': { backgroundColor: lighten(theme.palette.primary.main, 0.125) },
      };
      break;
    }
  }

  return {
    ...styles,
  };
});
