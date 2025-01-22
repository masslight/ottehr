import React from 'react';
import { Typography, useTheme } from '@mui/material';

interface PageHeaderProps {
  title: string;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  component?: React.ElementType;
  color?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, variant = 'h3', component = 'h1', color }) => {
  const theme = useTheme();

  return (
    <Typography
      variant={variant}
      component={component}
      sx={{
        ...theme.typography[variant],
        color: color || theme.palette.primary.dark,
      }}
    >
      {title}
    </Typography>
  );
};
