import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import type { SavedAdHocReport } from 'utils/lib/types/adhoc/saved/saved.types';
import { fileStore, supportsFolders } from '../files/fileStore';
import { listSavedReports } from '../instance/zambdaClient';
import { sendMessage } from '../llm/chat';
import { emptyReport, StudioReport } from '../report/types';
import { useStudio } from '../state/store';

/** Open: a report file from the folder (or any file), a new report, or a legacy saved report from the instance as a starting point. */
export function OpenDialog(): React.ReactElement {
  const open = useStudio((s) => s.openDialog);
  const setOpen = useStudio((s) => s.setOpenDialog);
  const file = useStudio((s) => s.file);
  const setFile = useStudio((s) => s.setFile);
  const replaceReport = useStudio((s) => s.replaceReport);
  const addEvent = useStudio((s) => s.addEvent);
  const busy = useStudio((s) => s.busy);
  const [tab, setTab] = useState<'files' | 'instance'>('files');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedAdHocReport[] | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);

  useEffect(() => {
    if (!open || tab !== 'instance' || saved) return;
    setLoadingSaved(true);
    listSavedReports()
      .then((r) => setSaved(r.reports))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingSaved(false));
  }, [open, tab, saved]);

  const guard = async (action: () => Promise<void>): Promise<void> => {
    setError(null);
    try {
      await action();
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const openFolder = (): Promise<void> =>
    guard(async () => {
      await fileStore.pickFolder();
      setFile({
        mode: 'folder',
        folderName: fileStore.folderName,
        files: await fileStore.listReports(),
        fileName: undefined,
      });
      addEvent('file', `Opened folder "${fileStore.folderName}"`);
    });

  const regrant = (): Promise<void> =>
    guard(async () => {
      if (await fileStore.regrant()) {
        setFile({ mode: 'folder', folderName: fileStore.folderName, files: await fileStore.listReports() });
        addEvent('file', `Folder "${fileStore.folderName}" re-opened`);
      }
    });

  const load = (report: StudioReport, fileName?: string): void => {
    replaceReport(report, { fileName, dirty: false });
    addEvent('file', `Opened ${fileName ?? report.name}`);
    setOpen(false);
  };

  const openFile = (name: string): Promise<void> => guard(async () => load(await fileStore.readReport(name), name));

  const pickFile = (): Promise<void> =>
    guard(async () => {
      const { fileName, report } = await fileStore.pickFile();
      if (file.mode !== 'folder') setFile({ mode: 'file' });
      load(report, fileName);
    });

  const fromLegacy = (legacy: SavedAdHocReport): void => {
    const fresh = emptyReport();
    replaceReport(
      { ...fresh, name: legacy.name, description: legacy.description, prompt: legacy.request },
      { fileName: undefined, dirty: true }
    );
    setOpen(false);
    void sendMessage(
      `Rebuild this saved report in the studio. Its name: "${legacy.name}". Original request: """${legacy.request}""". ` +
        `It used the legacy "${legacy.datasetId}" dataset; call get_saved_report with id ${legacy.id} to read its old code as a spec of the columns and groupings, then plan, run and build it here.`
    );
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>Open</DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3 }}>
        <Tab value="files" label="Files" />
        <Tab value="instance" label="From the instance (library)" />
      </Tabs>
      <DialogContent dividers sx={{ minHeight: 320 }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}
        {tab === 'files' && (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              {supportsFolders() ? (
                <Button variant="outlined" onClick={() => void openFolder()}>
                  {file.folderName ? 'Choose another folder' : 'Open folder'}
                </Button>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  This browser cannot open folders (Chrome or Edge can); open single files instead.
                </Typography>
              )}
              <Button variant="outlined" onClick={() => void pickFile()}>
                Open file…
              </Button>
              <Button onClick={() => load(emptyReport())}>New report</Button>
              {file.folderName && file.mode !== 'folder' && supportsFolders() && (
                <Button variant="contained" onClick={() => void regrant()}>
                  Re-open "{file.folderName}"
                </Button>
              )}
            </Stack>
            {file.mode === 'folder' && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Folder "{file.folderName}" — reports are plain JSON files (*.report.json); edits from other tools are
                  picked up every 2 s.
                </Typography>
                {file.files.length === 0 ? (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    No report files yet. Build one and press Save.
                  </Typography>
                ) : (
                  <List dense>
                    {file.files.map((f) => (
                      <ListItemButton
                        key={f.name}
                        selected={f.name === file.fileName}
                        onClick={() => void openFile(f.name)}
                      >
                        <ListItemText
                          primary={f.reportName}
                          secondary={`${f.name} · ${new Date(f.lastModified).toLocaleString()}`}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>
            )}
          </Stack>
        )}
        {tab === 'instance' && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              The instance's saved ad hoc reports (today's dataset-based ones). Picking one starts a conversation that
              rebuilds it here from its original request.
            </Typography>
            {loadingSaved && <Typography sx={{ mt: 1 }}>Loading…</Typography>}
            {saved && saved.length === 0 && <Typography sx={{ mt: 1 }}>No saved reports on this instance.</Typography>}
            {saved && saved.length > 0 && (
              <List dense>
                {saved.map((r) => (
                  <ListItemButton key={r.id} disabled={busy} onClick={() => fromLegacy(r)}>
                    <ListItemText
                      primary={r.name}
                      secondary={r.description || r.request}
                      secondaryTypographyProps={{ noWrap: true }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
