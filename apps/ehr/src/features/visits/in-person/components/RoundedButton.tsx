import { Button, styled } from '@mui/material';

export const ButtonRounded = styled(Button)(({ theme, variant, size = 'medium' }) => ({
  margin: 2,
  borderRadius: '18px',
  textTransform: 'none',
  boxShadow: 'none',
  padding: '6px 16px',
  minWidth: 'auto',
  width: 'auto',
  ...(size === 'medium' && {
    height: '36px',
    fontSize: '0.875rem',
  }),
  ...(size === 'large' && {
    height: '42px',
    fontSize: '1rem',
    padding: '6px 32px',
    fontWeight: 900,
    borderRadius: '28px',
  }),
  ...(variant === 'outlined' && {
    backgroundColor: 'white',
    color: theme.palette.primary.main,
    border: `1px solid ${theme.palette.primary.main}`,
    '&:hover': {
      backgroundColor: 'rgba(77, 21, 183, 0.04)',
      borderColor: theme.palette.primary.dark,
    },
  }),
  ...(variant === 'contained' && {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    border: 'none',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  }),
}));
