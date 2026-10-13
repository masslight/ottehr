import { javascript } from '@codemirror/lang-javascript';
import CodeMirror from '@uiw/react-codemirror';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { noteManualEdit } from '../../llm/chat';
import { runReport } from '../../report/runner';
import { useStudio } from '../../state/store';

/** The report code, editable. Apply re-renders on the last fetched data (no refetch) when there is one. */
export function CodePanel(): React.ReactElement {
  const code = useStudio((s) => s.report.code);
  const run = useStudio((s) => s.run);
  const setReport = useStudio((s) => s.setReport);
  const addEvent = useStudio((s) => s.addEvent);
  const [text, setText] = useState(code);

  useEffect(() => setText(code), [code]);

  const apply = (): void => {
    setReport({ code: text });
    noteManualEdit('report code');
    addEvent('info', 'Code edited by hand');
    void runReport({ reuseData: Boolean(run.resources) });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2, gap: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Report code
        </Typography>
        <Typography variant="caption" color="text.secondary">
          JSX function body · in scope: React, MUI, Report, resources, helpers, params · ends with return ReportRoot;
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" disabled={text === code} onClick={apply}>
          Apply & render
        </Button>
      </Stack>
      {run.render && !run.render.ok && run.render.error && (
        <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>
          {run.render.error}
        </Alert>
      )}
      <Box sx={{ flex: 1, minHeight: 0, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <CodeMirror
          value={text}
          height="100%"
          style={{ height: '100%', fontSize: 12.5 }}
          extensions={[javascript({ jsx: true })]}
          onChange={setText}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
              e.preventDefault();
              if (text !== code) apply();
            }
          }}
        />
      </Box>
    </Box>
  );
}
