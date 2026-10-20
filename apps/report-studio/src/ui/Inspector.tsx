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

const KIND_HELP: Record<InspectorKind, string> = {
  info: 'General information',
  fetch: "The fetch: the plan's FHIR searches, run by the fetch zambda",
  render: 'The sandbox running the report code and drawing the report',
  warn: 'Something worth checking: a heavy search, the request budget, a field blank on most rows',
  error: 'Something failed: a search, the report code, a tool, or a file',
  llm: 'Claude: a tool it called, or the turn itself',
  file: 'Opening, saving or testing a report file',
};

/**
 * What is happening behind the scenes (fetch timings, renders, warnings, tools): a strip with the log folded
 * away, or with `expanded` the log always shown, filling the height (the main window's Under-the-hood drawer).
 */
export function Inspector({ expanded = false }: { expanded?: boolean } = {}): React.ReactElement {
  const events = useStudio((s) => s.events);
  const run = useStudio((s) => s.run);
  const clearEvents = useStudio((s) => s.clearEvents);
  const [toggled, setToggled] = useState(false);
  const open = expanded || toggled;
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
    <Box
      sx={{
        borderTop: expanded ? 0 : 1,
        borderColor: 'divider',
        bgcolor: '#fbfcfe',
        ...(expanded && { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.4 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          Inspector
        </Typography>
        {run.fetch && (
          <>
            <Tooltip title="Time the server took to run the plan's searches, not counting the download to the browser or the render">
              <Chip size="small" variant="outlined" label={`fetch ${run.fetch.totalMs} ms`} />
            </Tooltip>
            <Tooltip title="FHIR resources the plan returned, all steps together, and their size">
              <Chip
                size="small"
                variant="outlined"
                label={`${total.toLocaleString()} resources · ${(run.fetch.totalBytes / 1024 / 1024).toFixed(1)} MB`}
              />
            </Tooltip>
          </>
        )}
        {run.render && (
          <Tooltip
            title={
              run.render.ok
                ? 'Time the sandbox took to run the report code and draw the report'
                : 'The report code failed; the Report tab shows the error'
            }
          >
            <Chip
              size="small"
              variant="outlined"
              color={run.render.ok ? 'success' : 'error'}
              label={run.render.ok ? `render ${run.render.ms} ms` : 'render failed'}
            />
          </Tooltip>
        )}
        {errors > 0 && (
          <Tooltip title="Plan steps whose search failed; the Plan tab shows each error">
            <Chip size="small" color="error" label={`${errors} step error(s)`} />
          </Tooltip>
        )}
        {warnings > 0 && (
          <Tooltip title="Warnings in the log below (expand the inspector to read them)">
            <Chip size="small" color="warning" variant="outlined" label={`${warnings} warning(s)`} />
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Clear">
          <IconButton size="small" onClick={clearEvents}>
            <Typography variant="caption">clear</Typography>
          </IconButton>
        </Tooltip>
        {!expanded && (
          <IconButton size="small" onClick={() => setToggled((o) => !o)} title={open ? 'Hide the log' : 'Show the log'}>
            {open ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
          </IconButton>
        )}
      </Box>
      {open && (
        <Box
          ref={listRef}
          sx={{
            ...(expanded ? { flex: 1, minHeight: 0 } : { maxHeight: 150 }),
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
              <Box
                component="span"
                title={KIND_HELP[e.kind]}
                sx={{ color: COLORS[e.kind], fontWeight: 600, width: 46, flexShrink: 0, cursor: 'help' }}
              >
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
