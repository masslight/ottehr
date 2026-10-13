import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { InspectorKind, useStudio } from '../state/store';

const COLORS: Record<InspectorKind, string> = {
  info: '#5a6578',
  fetch: '#0F347C',
  render: '#1f7a4d',
  warn: '#b26a00',
  error: '#b3261e',
  llm: '#6b3fa0',
  file: '#5a6578',
};

/** The strip under the live panel: what is happening behind the scenes (fetch timings, renders, warnings, tools). */
export function Inspector(): React.ReactElement {
  const events = useStudio((s) => s.events);
  const run = useStudio((s) => s.run);
  const clearEvents = useStudio((s) => s.clearEvents);
  const [open, setOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events, open]);

  const steps = run.fetch?.stats ?? [];
  const total = steps.reduce((n, s) => n + s.count, 0);
  const errors = steps.filter((s) => s.error).length;
  const warnings = events.filter((e) => e.kind === 'warn').length;

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: '#fbfcfe' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.4 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          Inspector
        </Typography>
        {run.fetch && (
          <>
            <Chip size="small" variant="outlined" label={`fetch ${run.fetch.totalMs} ms`} />
            <Chip
              size="small"
              variant="outlined"
              label={`${total.toLocaleString()} resources · ${(run.fetch.totalBytes / 1024 / 1024).toFixed(1)} MB`}
            />
          </>
        )}
        {run.render && (
          <Chip
            size="small"
            variant="outlined"
            color={run.render.ok ? 'success' : 'error'}
            label={run.render.ok ? `render ${run.render.ms} ms` : 'render failed'}
          />
        )}
        {errors > 0 && <Chip size="small" color="error" label={`${errors} step error(s)`} />}
        {warnings > 0 && <Chip size="small" color="warning" variant="outlined" label={`${warnings} warning(s)`} />}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Clear">
          <IconButton size="small" onClick={clearEvents}>
            <Typography variant="caption">clear</Typography>
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={() => setOpen((o) => !o)}>
          {open ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </IconButton>
      </Box>
      {open && (
        <Box
          ref={listRef}
          sx={{
            maxHeight: 150,
            overflow: 'auto',
            px: 1.5,
            pb: 0.75,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11.5,
          }}
        >
          {events.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              Nothing yet. Run the report or ask Claude for one.
            </Typography>
          )}
          {events.map((e) => (
            <Box key={e.id} sx={{ display: 'flex', gap: 1, py: 0.15, alignItems: 'baseline' }}>
              <Box component="span" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                {new Date(e.time).toLocaleTimeString([], { hour12: false })}
              </Box>
              <Box component="span" sx={{ color: COLORS[e.kind], fontWeight: 600, width: 46, flexShrink: 0 }}>
                {e.kind}
              </Box>
              <Box component="span" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {e.message}
                {e.detail && (
                  <Box component="span" sx={{ display: 'block', color: 'text.secondary', pl: 1 }}>
                    {e.detail}
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
