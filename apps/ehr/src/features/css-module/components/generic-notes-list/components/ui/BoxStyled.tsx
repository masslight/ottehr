import React from 'react';
import { Box, useTheme, alpha } from '@mui/material';

export const BoxStyled: React.FC<React.ComponentProps<typeof Box>> = ({ children, ...props }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        '&:hover': {
          backgroundColor: alpha(theme.palette.primary.light, 0.08),
        },
        transition: 'background-color 0.3s',
        py: 0.5,
        px: 3,
        borderRadius: 1,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};
