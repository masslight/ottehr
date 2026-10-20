import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { fileNameFor, fileStore } from '../files/fileStore';
import { canSignIn, desktop, signIn, storedToken } from '../instance/login';
import { runReport } from '../report/runner';
import { resolveInputs } from '../report/inputs';
import { emptyReport, hasReport } from '../report/types';
import { Environment, ShowAs, useStudio } from '../state/store';
import { loadReport } from './OpenDialog';

// The last result came from the other environment; never show it under this one's name.
function selectEnvironment(name: string): void {
  const { settings, setEnvironment, setRun } = useStudio.getState();
  setEnvironment(settings.environments.find((env) => env.name === name));
  setRun({ status: 'idle' });
}

const SHOW_AS: { id: ShowAs; label: string; help: string }[] = [
  { id: 'reports', label: 'Reports page', help: "Full width, as on the EHR's Reports page" },
  { id: 'visit', label: 'Inside a visit', help: "About 820 px wide, as in a visit's Reports section" },
  { id: 'narrow', label: 'Narrow', help: 'About 600 px wide, to check small layouts' },
];

/**
 * Save, or with `asNew` Save as… (always asks for a name and place). Resolves what to tell the user
 * ("Saved x.report.json"), or undefined when they cancelled the save dialog.
 */
export async function saveReport(asNew = false): Promise<string | undefined> {
  const { report, file, setFile, setReport, addEvent } = useStudio.getState();
  const stamped = { ...report, updatedAt: new Date().toISOString() };
  let fileName: string | undefined = file.fileName ?? fileNameFor(report.name);
  try {
    if (asNew) {
      const saved = await fileStore.saveAs(fileName, stamped);
      if (!saved) return undefined;
      fileName = saved.fileName;
      if (saved.inFolder)
        setFile({ fileName, dirty: false, changedOnDisk: false, files: await fileStore.listReports() });
      else setFile({ mode: 'file', fileName, dirty: false });
    } else if (file.mode === 'folder') {
      await fileStore.writeReport(fileName, stamped);
      setFile({ fileName, dirty: false, changedOnDisk: false, files: await fileStore.listReports() });
    } else if (file.fileName && file.fileName === fileStore.pickedFileName) {
      // a new report (no file name yet) never overwrites the file the last one was saved to
      await fileStore.saveToPickedFile(stamped);
      setFile({ fileName, dirty: false });
    } else {
      const saved = await fileStore.saveAs(fileName, stamped);
      if (!saved) return undefined;
      fileName = saved.fileName;
      setFile({ mode: 'file', fileName, dirty: false });
    }
    setReport({ updatedAt: stamped.updatedAt }, { dirty: false });
    addEvent('file', `Saved ${fileName}`);
    return `Saved ${fileName}`;
  } catch (error) {
    addEvent('error', `Save failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

export function TopBar(): React.ReactElement {
  const report = useStudio((s) => s.report);
  const setReport = useStudio((s) => s.setReport);
  const run = useStudio((s) => s.run);
  const file = useStudio((s) => s.file);
  const settings = useStudio((s) => s.settings);
  const setSettingsOpen = useStudio((s) => s.setSettingsOpen);
  const setOpenDialog = useStudio((s) => s.setOpenDialog);
  const showAs = useStudio((s) => s.showAs);
  const setShowAs = useStudio((s) => s.setShowAs);
  const environment = useStudio((s) => s.environment);
  const testCase = useStudio((s) => s.testCase);
  const setTestCase = useStudio((s) => s.setTestCase);
  const [saving, setSaving] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const needsSignIn = !!environment && canSignIn(environment) && !storedToken(environment) && !environment.accessToken;
  const startSignIn = (): void => {
    if (!environment) return;
    setSigningIn(true);
    signIn(environment)
      .then((accessToken) => useStudio.getState().setEnvironment({ ...environment, accessToken }))
      .catch((e: unknown) => useStudio.getState().addEvent('error', e instanceof Error ? e.message : String(e)))
      .finally(() => setSigningIn(false));
  };
  const [saveMessage, setSaveMessage] = useState<{ text: string; error?: boolean }>();
  // Resolves whether the report was saved (false: the user cancelled, or it failed and the snackbar says so).
  const save = useCallback((asNew: boolean): Promise<boolean> => {
    setSaving(true);
    return saveReport(asNew)
      .then((text) => {
        if (text) setSaveMessage({ text });
        return text !== undefined;
      })
      .catch((e) => {
        setSaveMessage({ text: `Save failed: ${e instanceof Error ? e.message : String(e)}`, error: true });
        return false;
      })
      .finally(() => setSaving(false));
  }, []);

  // Desktop app: the File menu stands in for the Open / Save / Save as… buttons and runs the same actions.
  const inDesktop = !!desktop();
  useEffect(
    () =>
      desktop()?.onMenu?.((action) => {
        if (action === 'new') loadReport(emptyReport());
        else if (action === 'open') setOpenDialog(true);
        else void save(action === 'saveAs').then((ok) => desktop()?.saveResult?.(ok));
      }),
    [save, setOpenDialog]
  );

  const running = run.status === 'fetching' || run.status === 'rendering';
  const nothingToRun = !hasReport(report);
  // Desktop app: the tab strip shows this tab's name, a running dot and an unsaved mark.
  useEffect(
    () =>
      desktop()?.setTabState?.({
        title: nothingToRun ? 'New report' : report.name || 'Untitled report',
        running,
        dirty: file.dirty,
        empty: nothingToRun,
      }),
    [report.name, running, file.dirty, nothingToRun]
  );
  const { missing } = resolveInputs(report, testCase);
  const runBlocked = missing.length ? `Needs ${missing.join(', ')}` : undefined;
  const configured = Boolean(environment && (settings.connection !== 'direct' || settings.apiKey));

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: 'primary.main',
        color: '#fff',
      }}
    >
      <InputBase
        value={report.name}
        onChange={(e) => setReport({ name: e.target.value })}
        placeholder="Report name"
        sx={{
          color: '#fff',
          fontWeight: 500,
          fontSize: 15,
          px: 1,
          borderRadius: 1,
          minWidth: 220,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
        }}
      />
      {hasReport(report) && (
        <Typography variant="caption" sx={{ color: file.dirty ? '#ffd666' : 'rgba(255,255,255,0.7)' }}>
          {file.dirty ? 'Unsaved changes' : 'Saved'}
        </Typography>
      )}
      {file.changedOnDisk && (
        <Tooltip title="The file changed on disk (another editor saved it). Open it again to reload.">
          <Chip size="small" color="warning" label="changed on disk" />
        </Tooltip>
      )}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={showAs}
        onChange={(_, v: ShowAs | null) => v && setShowAs(v)}
        aria-label="Show the report as"
        sx={{
          bgcolor: 'rgba(255,255,255,0.12)',
          '& .MuiToggleButton-root': { color: '#fff', border: 0, px: 1.5, py: 0.5, lineHeight: 1.5 },
          '& .MuiToggleButton-root.Mui-selected': { bgcolor: '#fff', color: 'primary.main' },
          '& .MuiToggleButton-root.Mui-selected:hover': { bgcolor: '#fff' },
        }}
      >
        {SHOW_AS.map((m) => (
          <ToggleButton key={m.id} value={m.id} title={m.help}>
            {m.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Box sx={{ flex: 1 }} />
      {(report.inputs?.length ?? 0) > 0 && (
        <Select
          value={report.testCases?.some((t) => t.name === testCase) ? testCase : report.testCases?.[0]?.name ?? ''}
          onChange={(e) => setTestCase(e.target.value)}
          disabled={running}
          size="small"
          inputProps={{ 'aria-label': 'Test case' }}
          sx={{ ...whiteOutline, minWidth: 160 }}
        >
          {(report.testCases ?? []).map((t) => (
            <MenuItem key={t.name} value={t.name}>
              Test case: {t.name}
            </MenuItem>
          ))}
        </Select>
      )}
      <Button
        variant="contained"
        color="secondary"
        startIcon={running ? <CircularProgress size={14} color="inherit" /> : <PlayArrowRoundedIcon />}
        disabled={running || nothingToRun || needsSignIn || !!runBlocked}
        onClick={() => void runReport()}
        sx={{ fontWeight: 600, '&.Mui-disabled': { color: 'rgba(255,255,255,0.5)' } }}
      >
        {running ? (run.status === 'fetching' ? 'Fetching…' : 'Rendering…') : 'Run'}
      </Button>
      {runBlocked && !nothingToRun && (
        <Typography variant="caption" sx={{ color: '#ffd666' }}>
          {runBlocked}
        </Typography>
      )}
      {!inDesktop && (
        <>
          <Button color="inherit" startIcon={<FolderOpenOutlinedIcon />} onClick={() => setOpenDialog(true)}>
            Open
          </Button>
          <Button
            color="inherit"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlinedIcon />}
            disabled={saving}
            onClick={() => void save(false)}
          >
            Save
          </Button>
          <Tooltip title="Save under another name or in another place; later saves go to the new file">
            <span>
              <Button color="inherit" disabled={saving} onClick={() => void save(true)}>
                Save as…
              </Button>
            </span>
          </Tooltip>
        </>
      )}
      <Snackbar
        open={!!saveMessage}
        autoHideDuration={saveMessage?.error ? null : 3000}
        onClose={(_e, reason) => reason !== 'clickaway' && setSaveMessage(undefined)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={saveMessage?.error ? 'error' : 'success'}
          variant="filled"
          onClose={() => setSaveMessage(undefined)}
        >
          {saveMessage?.text}
        </Alert>
      </Snackbar>
      {settings.environments.length > 0 && (
        <Select
          value={environment?.name ?? ''}
          onChange={(e) => selectEnvironment(e.target.value)}
          disabled={running}
          size="small"
          inputProps={{ 'aria-label': 'Environment' }}
          sx={{ ...whiteOutline, minWidth: 160 }}
        >
          {settings.environments.map((env) => (
            <MenuItem key={env.name} value={env.name}>
              {env.name}
              {env.production ? ' (production)' : ''}
            </MenuItem>
          ))}
        </Select>
      )}
      {environment?.production && <Chip size="small" color="error" label="Production" />}
      {needsSignIn && (
        <Button
          variant="contained"
          color="inherit"
          sx={{ color: 'primary.main' }}
          disabled={signingIn}
          onClick={startSignIn}
        >
          {signingIn ? 'Signing in…' : `Sign in to ${environment?.name}`}
        </Button>
      )}
      <Tooltip
        title={
          configured
            ? `Environment: ${environment?.name} · ${settings.model}`
            : 'Set up an environment and the Claude connection'
        }
      >
        {configured ? (
          <IconButton color="inherit" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            <SettingsOutlinedIcon />
          </IconButton>
        ) : (
          <Button startIcon={<SettingsOutlinedIcon />} onClick={() => setSettingsOpen(true)} sx={{ color: '#ffd666' }}>
            Set up
          </Button>
        )}
      </Tooltip>
    </Box>
  );
}

const whiteOutline = {
  color: '#fff',
  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
  '.MuiSvgIcon-root': { color: '#fff' },
};
