import { Box } from '@mui/material';
import { FC, ReactNode } from 'react';
import { Sidebar } from './Sidebar';

// the space <main> leaves above and below a page; a header sticking to the top of <main> offsets by it
export const MAIN_PADDING_Y = 4;

export const Layout: FC<{ children: ReactNode }> = ({ children }) => (
  <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
    <Sidebar />
    <Box component="main" sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.default', px: 5, py: MAIN_PADDING_Y }}>
      {children}
    </Box>
  </Box>
);
