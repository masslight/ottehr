import { Box, SxProps, Theme, Typography } from '@mui/material';
import { ReactElement, ReactNode } from 'react';

// Top-label form field used by the billing edit forms and dialogs.
export function Field({
  label,
  optional,
  children,
  sx,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
  sx?: SxProps<Theme>;
}): ReactElement {
  return (
    <Box sx={sx}>
      <Typography
        variant="body2"
        sx={{ color: 'text.primary', fontSize: 13, fontWeight: 500, display: 'block', mb: 0.75 }}
      >
        {label}
        {optional && (
          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
            {' · optional'}
          </Box>
        )}
      </Typography>
      {children}
    </Box>
  );
}
