import { Close as CloseIcon } from '@mui/icons-material';
import { Box, Drawer, IconButton, Typography } from '@mui/material';
import { ReactElement, ReactNode } from 'react';

const DEFAULT_WIDTH = 480;

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}

export function SideDrawer({ open, onClose, title, children, width = DEFAULT_WIDTH }: SideDrawerProps): ReactElement {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width,
          maxWidth: '100vw',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          px: 3,
          pt: 3,
          pb: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16}>
          {title}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box
        sx={{
          px: 3,
          pb: 3,
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {children}
      </Box>
    </Drawer>
  );
}
