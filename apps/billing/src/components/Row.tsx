import { Box, Typography } from '@mui/material';
import { ReactElement, ReactNode } from 'react';
import { otherColors } from 'utils/lib/theme/billing-palette';

export function Row({
  label,
  value,
  hideBorder,
}: {
  label: string;
  value: ReactNode;
  hideBorder?: boolean;
}): ReactElement {
  return (
    <Box sx={{ display: 'flex', py: 0.75, borderBottom: hideBorder ? '' : `1px solid ${otherColors.lightDivider}` }}>
      <Typography variant="body2" color="primary.dark" sx={{ width: 180, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value || '-'}</Typography>
    </Box>
  );
}
