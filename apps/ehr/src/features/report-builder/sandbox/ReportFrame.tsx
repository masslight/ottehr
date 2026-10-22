import { Box, CircularProgress, Typography } from '@mui/material';
import React from 'react';
import { SandboxData, useSandbox } from '../hooks/useSandbox';

type ReportFrameProps = SandboxData & {
  code: string;
  onError: (message: string) => void;
  onRendered?: () => void;
};

export function ReportFrame({ code, onError, onRendered, ...sandboxData }: ReportFrameProps): React.ReactElement {
  const { frameProps, rendering } = useSandbox({ code, onError, onRendered, ...sandboxData });

  if (!frameProps) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <iframe {...frameProps} />
      {rendering && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            bgcolor: 'background.paper',
          }}
        >
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">
            Building the report…
          </Typography>
        </Box>
      )}
    </Box>
  );
}
