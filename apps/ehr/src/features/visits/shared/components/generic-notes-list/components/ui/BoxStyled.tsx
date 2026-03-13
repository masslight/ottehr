import { alpha, Box, useTheme } from '@mui/material';
import React from 'react';

interface Props extends React.ComponentProps<typeof Box> {
  dataTestId?: string;
}

export const BoxStyled: React.FC<Props> = ({ children, ...props }) => {
  const theme = useTheme();
  return (
    <Box
      data-testid={props.dataTestId}
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
