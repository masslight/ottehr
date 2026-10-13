import { Box, Paper, Tab, Tabs } from '@mui/material';
import React, { useEffect } from 'react';
import { fileStore } from '../files/fileStore';
import { RightTab, useStudio } from '../state/store';
import { Chat } from './Chat';
import { Inspector } from './Inspector';
import { OpenDialog } from './OpenDialog';
import { CodePanel } from './panels/CodePanel';
import { DataPanel } from './panels/DataPanel';
import { PlanPanel } from './panels/PlanPanel';
import { ReportPanel } from './panels/ReportPanel';
import { SettingsDialog } from './SettingsDialog';
import { TopBar } from './TopBar';

const TABS: { id: RightTab; label: string }[] = [
  { id: 'report', label: 'Report' },
  { id: 'plan', label: 'Plan' },
  { id: 'code', label: 'Code' },
  { id: 'data', label: 'Data' },
];

const FILE_POLL_MS = 2000;

export function App(): React.ReactElement {
  const tab = useStudio((s) => s.tab);
  const setTab = useStudio((s) => s.setTab);
  const run = useStudio((s) => s.run);

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

  const badge = (id: RightTab): string => {
    if (id === 'report' && run.status === 'error') return ' ●';
    if (id === 'plan' && run.fetch?.stats.some((s) => s.error)) return ' ●';
    return '';
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <TopBar />
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 1.5, p: 1.5, pt: 1 }}>
        <Paper
          variant="outlined"
          sx={{ width: 440, minWidth: 360, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <Chat />
        </Paper>
        <Paper
          variant="outlined"
          sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v as RightTab)}
            sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40, px: 1 }}
          >
            {TABS.map((t) => (
              <Tab
                key={t.id}
                value={t.id}
                label={`${t.label}${badge(t.id)}`}
                sx={{ minHeight: 40, py: 0, fontWeight: 500 }}
              />
            ))}
          </Tabs>
          <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {/* The report frame stays mounted so the sandbox keeps its state and renders while another tab shows. */}
            <Box
              sx={{ position: 'absolute', inset: 0, display: tab === 'report' ? 'block' : 'none', overflow: 'auto' }}
            >
              <ReportPanel />
            </Box>
            {tab === 'plan' && <PlanPanel />}
            {tab === 'code' && <CodePanel />}
            {tab === 'data' && <DataPanel />}
          </Box>
          <Inspector />
        </Paper>
      </Box>
      <SettingsDialog />
      <OpenDialog />
    </Box>
  );
}
