import { Box, Typography } from '@mui/material';
import { ReactElement } from 'react';

export function PlaceholderPage({ title }: { title: string }): ReactElement {
  return (
    <Box>
      <Typography variant="h4" color="primary.dark" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        This page is coming soon.
      </Typography>
    </Box>
  );
}
