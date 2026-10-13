import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { sandbox } from '../../sandbox/controller';
import { useStudio } from '../../state/store';

const MIN_HEIGHT = 240;

/** The live rendered report: the sandboxed iframe (always mounted) with run status around it. */
export function ReportPanel(): React.ReactElement {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const run = useStudio((s) => s.run);
  const report = useStudio((s) => s.report);
  const addEvent = useStudio((s) => s.addEvent);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    sandbox.attach(frameRef.current);
    const unsubscribe = sandbox.subscribe((message) => {
      if (
        'type' in message &&
        (message.type === 'rendered' || message.type === 'resize') &&
        typeof message.height === 'number'
      ) {
        setHeight(Math.max(MIN_HEIGHT, message.height + 24));
      }
      if ('event' in message) {
        // Report links open EHR routes; the studio has no EHR to open, so it just shows what was asked.
        addEvent('info', `Report link: ${JSON.stringify((message as { options?: unknown }).options ?? message)}`);
      }
    });
    return () => {
      unsubscribe();
      sandbox.attach(null);
    };
  }, [addEvent]);

  const busy = run.status === 'fetching' || run.status === 'rendering';

  return (
    <Box sx={{ p: 2 }}>
      {report.title && (
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          {report.title}
        </Typography>
      )}
      {run.status === 'idle' && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Press Run (or ask Claude) to fetch the plan and render this report.
        </Alert>
      )}
      {run.status === 'error' && run.error && (
        <Alert severity="error" sx={{ mb: 1.5, whiteSpace: 'pre-wrap' }}>
          {run.error}
        </Alert>
      )}
      {run.fetch?.stats.some((s) => s.error) && run.status !== 'error' && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {run.fetch.stats
            .filter((s) => s.error)
            .map((s) => `Step ${s.id}: ${s.error}`)
            .join(' · ')}
        </Alert>
      )}
      <Box sx={{ position: 'relative' }}>
        <iframe
          ref={frameRef}
          title="Report"
          sandbox="allow-scripts"
          srcDoc={sandbox.srcDoc}
          style={{
            width: '100%',
            height,
            border: '1px solid #e0e4ea',
            borderRadius: 8,
            background: '#fff',
            display: 'block',
          }}
        />
        {busy && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              bgcolor: 'rgba(255,255,255,0.85)',
              borderRadius: 2,
            }}
          >
            <CircularProgress size={26} />
            <Typography variant="body2" color="text.secondary">
              {run.status === 'fetching' ? 'Fetching data from the instance…' : 'Rendering the report…'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
