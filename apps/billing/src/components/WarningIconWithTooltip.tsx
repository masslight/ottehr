import { WarningAmber as WarningAmberIcon } from '@mui/icons-material';
import { Box, Tooltip } from '@mui/material';
import { ReactElement } from 'react';

export function WarningIconWithTooltip({ tooltipText }: { tooltipText: string }): ReactElement {
  return (
    <Tooltip title={tooltipText}>
      <Box
        component="span"
        role="img"
        aria-label={tooltipText}
        tabIndex={0}
        sx={{ display: 'inline-flex', color: 'warning.main' }}
      >
        <WarningAmberIcon sx={{ fontSize: 16 }} />
      </Box>
    </Tooltip>
  );
}
