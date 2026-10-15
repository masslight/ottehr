import { Typography } from '@mui/material';
import { Box, Stack, SxProps } from '@mui/system';
import { ReactElement } from 'react';
import { formatCurrency } from 'utils/lib/utils/convert';
import { WarningIconWithTooltip } from './WarningIconWithTooltip';

export function Amount({
  label,
  sublabel,
  value,
  hint,
  sx,
}: {
  label: string;
  sublabel?: string;
  value: number;
  hint?: string;
  sx?: SxProps;
}): ReactElement {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 48, ...sx }}>
      <Box>
        <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
          {label}
        </Typography>
        {sublabel && (
          <Typography variant="caption" display="block" color="text.secondary" fontSize={10} lineHeight={1.2}>
            {sublabel}
          </Typography>
        )}
      </Box>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Typography variant="body1" fontWeight={600}>
          {formatCurrency(value)}
        </Typography>
        {hint && <WarningIconWithTooltip tooltipText={hint} />}
      </Stack>
    </Box>
  );
}
