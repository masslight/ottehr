import { InputLabel, styled } from '@mui/material';

export const BoldPurpleInputLabel = styled(InputLabel)(({ theme }) => ({
  fontWeight: 500,
  fontSize: 16,
  transform: 'translate(0, -9px) scale(1)',
  color: theme.palette.primary.main,
}));
