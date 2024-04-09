import { styled, ToggleButton } from '@mui/material';

export const ContainedPrimaryToggleButton = styled(ToggleButton)(({ theme }) => ({
  color: theme.palette.primary.main,
  borderColor: theme.palette.primary.main,
  textTransform: 'none',
  padding: '6px 16px',
  fontWeight: 700,
  transition: 'background .25s, color .25s',
  '&.Mui-selected': {
    color: 'white',
    backgroundColor: theme.palette.primary.main,
  },
  '&.Mui-selected:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));
