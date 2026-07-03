import { Box, CircularProgress } from '@mui/material';
import React from 'react';
import { AdHocRow, LlmDatasetSchema } from 'utils';
import { useSandbox } from '../hooks/useSandbox';

interface ReportFrameProps {
  /** The generated JSX artifact; the frame's runtime transpiles + executes it over `data`. */
  code: string;
  data: AdHocRow[];
  schema: LlmDatasetSchema;
  onError: (message: string) => void;
  /** Fired when the generated code renders without throwing — lets the page persist an auto-repaired
   *  report so it doesn't crash-then-retry on every open. */
  onRendered?: () => void;
}

// Thin view over useSandbox: the hook owns the frame content, the message protocol, and the event
// whitelist; this component just places the iframe.
export function ReportFrame({ code, data, schema, onError, onRendered }: ReportFrameProps): React.ReactElement {
  const { frameProps } = useSandbox({ code, data, schema, onError, onRendered });
  // frameProps is null until the code-split runtime chunk has loaded; don't mount the frame yet.
  if (!frameProps) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  return <iframe {...frameProps} />;
}
