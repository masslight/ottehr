import { Paper } from '@mui/material';
import React from 'react';

export const PaperStyled: React.FC<React.ComponentProps<typeof Paper>> = ({ children, ...props }) => (
  <Paper elevation={3} sx={{ mt: 3, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }} {...props}>
    {children}
  </Paper>
);
