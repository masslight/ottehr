import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { fileStore } from '../files/fileStore';
import { RightTab, useStudio } from '../state/store';
import { Chat } from './Chat';
import { Inspector } from './Inspector';
import { OpenDialog } from './OpenDialog';
import { CodePanel } from './panels/CodePanel';
import { DataPanel } from './panels/DataPanel';
import { InputsPanel } from './panels/InputsPanel';
import { PlanPanel } from './panels/PlanPanel';
import { ReportPanel } from './panels/ReportPanel';
import { SettingsDialog } from './SettingsDialog';
import { ShowAsFrame } from './ShowAsFrame';
import { TopBar } from './TopBar';

// The Under-the-hood drawers, in button order. 'report' (no drawer) is what a run sets.
const DRAWERS: { id: Exclude<RightTab, 'report'>; label: string }[] = [
  { id: 'inputs', label: 'Inputs' },
  { id: 'plan', label: 'Plan' },
  { id: 'code', label: 'Code' },
  { id: 'data', label: 'Data' },
  { id: 'inspector', label: 'Inspector' },
];

const FILE_POLL_MS = 2000;
const CHAT_WIDTH = 370;

export function App(): React.ReactElement {
  const tab = useStudio((s) => s.tab);
  const setTab = useStudio((s) => s.setTab);
  const run = useStudio((s) => s.run);
  const showAs = useStudio((s) => s.showAs);
  const [chatOpen, setChatOpen] = useState(true);

  // Remember the folder from last time, and watch the open file for outside edits (e.g. Claude Code).
  useEffect(() => {
    let alive = true;
    void fileStore.restoreFolder().then(async (granted) => {
      if (!alive) return;
      const { setFile, addEvent } = useStudio.getState();
      if (granted) {
        setFile({ mode: 'folder', folderName: fileStore.folderName, files: await fileStore.listReports() });
        addEvent('file', `Folder "${fileStore.folderName}" re-opened`);
      } else if (fileStore.folderName) {
        setFile({ mode: 'none', folderName: fileStore.folderName });
      }
    });
    const timer = setInterval(async () => {
      const { file, setFile } = useStudio.getState();
      if (file.mode !== 'folder') return;
      const files = await fileStore.listReports();
      const changed = file.fileName ? await fileStore.changedOnDisk(file.fileName) : false;
      const same =
        files.length === file.files.length &&
        files.every((f, i) => f.name === file.files[i]?.name && f.lastModified === file.files[i]?.lastModified);
      if (!same || changed !== file.changedOnDisk) setFile({ files, changedOnDisk: changed });
    }, FILE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const badge = (id: RightTab): string => (id === 'plan' && run.fetch?.stats.some((s) => s.error) ? ' ●' : '');
  const steps = run.fetch?.stats ?? [];
  const records = steps.reduce((n, s) => n + s.count, 0);
  const drawer = DRAWERS.find((d) => d.id === tab);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <TopBar />
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 1.5, p: 1.5, pt: 1 }}>
        {chatOpen ? (
          <Paper
            variant="outlined"
            sx={{ width: CHAT_WIDTH, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <Chat onCollapse={() => setChatOpen(false)} />
          </Paper>
        ) : (
          <Tooltip title="Show the conversation" placement="right">
            <IconButton
              size="small"
              aria-label="Show the conversation"
              onClick={() => setChatOpen(true)}
              sx={{ alignSelf: 'flex-start', border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Paper
          variant="outlined"
          sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {/* The report frame stays mounted so the sandbox keeps its state and renders while a drawer shows. */}
            <Box sx={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
              <ShowAsFrame mode={showAs}>
                <ReportPanel />
              </ShowAsFrame>
            </Box>
            {drawer && (
              <Paper
                elevation={8}
                square
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '60%',
                  minHeight: 280,
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.5,
                    py: 0.25,
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: '#fbfcfe',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {drawer.label}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <IconButton size="small" aria-label={`Close ${drawer.label}`} onClick={() => setTab('report')}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  {tab === 'inputs' && <InputsPanel />}
                  {tab === 'plan' && <PlanPanel />}
                  {tab === 'code' && <CodePanel />}
                  {tab === 'data' && <DataPanel />}
                  {tab === 'inspector' && <Inspector expanded />}
                </Box>
              </Paper>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.75,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: '#fbfcfe',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Under the hood
            </Typography>
            {run.fetch && (
              <Typography variant="caption" color="text.secondary">
                {steps.length} fetch{steps.length === 1 ? '' : 'es'} · {records.toLocaleString()} records ·{' '}
                {(run.fetch.totalMs / 1000).toFixed(1)} s server · {(run.fetch.totalBytes / 1024 / 1024).toFixed(1)} MB
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              {DRAWERS.map((d) => (
                <Button
                  key={d.id}
                  variant={tab === d.id ? 'contained' : 'outlined'}
                  disableElevation
                  aria-pressed={tab === d.id}
                  onClick={() => setTab(tab === d.id ? 'report' : d.id)}
                >
                  {d.label}
                  {badge(d.id)}
                </Button>
              ))}
            </Box>
          </Box>
        </Paper>
      </Box>
      <SettingsDialog />
      <OpenDialog />
    </Box>
  );
}
