import { Box } from '@mui/material';
import { FC, ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export const Layout: FC<{ children: ReactNode }> = ({ children }) => (
  <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
    <Sidebar />
    <Box component="main" sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.default', px: 5, py: 4 }}>
      {children}
    </Box>
  </Box>
);
