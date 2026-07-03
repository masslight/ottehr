import { Box, Typography } from '@mui/material';
import React from 'react';

export interface SectionProps {
  title?: string;
  children: React.ReactNode;
}

/** A titled block of the report — heading + consistent spacing. */
export function Section({ title, children }: SectionProps): React.ReactElement {
  return (
    <Box sx={{ mb: 3 }}>
      {title && (
        <Typography variant="h6" component="h2" sx={{ mb: 1, fontWeight: 600, color: '#0a2e5c' }}>
          {title}
        </Typography>
      )}
      {children}
    </Box>
  );
}
