import { styled, Typography, TypographyProps } from '@mui/material';
import React from 'react';

export const AssessmentTitle = styled((props: TypographyProps) => (
  <Typography fontSize={16} fontWeight={700} {...props} />
))(({ theme }) => ({
  color: theme.palette.primary.dark,
}));
