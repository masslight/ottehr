import { Button } from '@mui/material';
import React from 'react';

export const ButtonStyled: React.FC<React.ComponentProps<typeof Button>> = ({ children, ...props }) => (
  <Button
    sx={{
      p: 1,
      py: 0.5,
      color: 'primary.main',
      minWidth: 'auto',
      '&:hover': { backgroundColor: 'transparent' },
      textTransform: 'none',
      fontWeight: 'bold',
    }}
    {...props}
  >
    {children}
  </Button>
);
