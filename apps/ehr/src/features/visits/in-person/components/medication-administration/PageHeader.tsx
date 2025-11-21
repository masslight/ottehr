import { Typography, useTheme } from '@mui/material';
import React from 'react';

interface PageHeaderProps {
  title: string;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  component?: React.ElementType;
  color?: string;
  dataTestId?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  variant = 'h3',
  component = 'h1',
  color,
  dataTestId,
}) => {
  const theme = useTheme();

  return (
    <Typography
      data-testid={dataTestId}
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
