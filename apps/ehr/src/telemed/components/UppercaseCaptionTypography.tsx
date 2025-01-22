import React from 'react';
import { styled, Typography, TypographyProps } from '@mui/material';

export const UppercaseCaptionTypography = styled((props: TypographyProps) => (
  <Typography variant="subtitle2" {...props} />
))(({ theme }) => ({
  textTransform: 'uppercase',
  color: theme.palette.primary.dark,
}));
