import { Box } from '@mui/material';
import { FC, ReactNode } from 'react';
import { Navbar } from './navigation/Navbar';
import { Sidebar } from './Sidebar';

export const Layout: FC<{ children: ReactNode }> = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    <Navbar />
    <Box sx={{ display: 'flex', flex: 1 }}>
      <Sidebar />
      <Box component="main" sx={{ flex: 1, overflow: 'auto' }}>
        {children}
      </Box>
    </Box>
  </Box>
);
