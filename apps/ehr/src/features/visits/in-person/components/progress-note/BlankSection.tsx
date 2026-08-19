import { Box, Typography } from '@mui/material';
import { FC } from 'react';

// Placeholder for a Review & Sign section whose summary container is only rendered when
// it has data. Shown instead so the section is still visible (and clickable to add)
// when blank — title must match the real container's heading.
export const BlankSection: FC<{ title: string; message: string }> = ({ title, message }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
    <Typography variant="h5" color="primary.dark">
      {title}
    </Typography>
    <Typography color="text.secondary">{message}</Typography>
  </Box>
);
