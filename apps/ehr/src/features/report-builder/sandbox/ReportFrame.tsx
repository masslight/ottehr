import { Box, CircularProgress, Typography } from '@mui/material';
import React from 'react';
import { AdHocRow, LlmDatasetSchema } from 'utils/lib/types/adhoc/datasets/llm-schema';
import { useSandbox } from '../hooks/useSandbox';

interface ReportFrameProps {
  code: string;
  data: AdHocRow[];
  schema: LlmDatasetSchema;
  onError: (message: string) => void;
  onRendered?: () => void;
}

export function ReportFrame({ code, data, schema, onError, onRendered }: ReportFrameProps): React.ReactElement {
  const { frameProps, rendering } = useSandbox({ code, data, schema, onError, onRendered });

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
