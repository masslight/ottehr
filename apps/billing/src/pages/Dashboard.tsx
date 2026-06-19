import { Box, Typography } from '@mui/material';
import { ReactElement } from 'react';

export default function Dashboard(): ReactElement {
  return (
    <Box sx={{ p: 0 }}>
      <Typography variant="h4" color="primary.dark" fontWeight={600}>
        Home
      </Typography>
    </Box>
  );
}
