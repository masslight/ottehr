import { Box, Typography } from '@mui/material';
import { ReactElement } from 'react';

export function DetailRow({
  label,
  value,
  labelWidth = 140,
}: {
  label: string;
  value: string;
  labelWidth?: number;
}): ReactElement {
  return (
    <Box sx={{ display: 'flex', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: labelWidth, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Box>
  );
}
