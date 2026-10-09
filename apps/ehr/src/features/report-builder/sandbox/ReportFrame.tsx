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

function ReportFrameInner({ code, data, schema, onError, onRendered }: ReportFrameProps): React.ReactElement {
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

// The page re-renders on every keystroke in its text boxes. Only code/data/schema change what the frame
// shows, so skip re-rendering the frame (and its multi-MB srcDoc element) for anything else. Callers must
// therefore pass onError/onRendered with a STABLE identity that forwards to their latest handlers — a
// callback that changes alone is not picked up.
export const ReportFrame = React.memo(
  ReportFrameInner,
  (prev, next) => prev.code === next.code && prev.data === next.data && prev.schema === next.schema
);
