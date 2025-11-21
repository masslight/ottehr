import { styled, Typography, TypographyProps } from '@mui/material';

export const MedHistorySubsectionTypography = styled((props: TypographyProps) => (
  <Typography variant="body1" {...props} />
))(({ theme }) => ({
  color: theme.palette.primary.dark,
  fontWeight: 'bold',
}));
