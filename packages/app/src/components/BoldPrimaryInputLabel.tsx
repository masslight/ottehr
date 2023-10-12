import { InputLabel, styled } from '@mui/material';

export const BoldPrimaryInputLabel = styled(InputLabel)(({ theme }) => ({
  color: theme.palette.secondary.main,
  fontSize: 16,
  fontWeight: 700,
  transform: 'translate(0, -9px) scale(1)',
}));
