import { styled, Typography, TypographyProps } from '@mui/material';
import React from 'react';

export const UppercaseCaptionTypography = styled((props: TypographyProps) => (
  <Typography variant="subtitle2" {...props} />
))(({ theme }) => ({
  textTransform: 'uppercase',
  color: theme.palette.primary.dark,
}));
