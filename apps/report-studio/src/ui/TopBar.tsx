import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputBase,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { planNeedsPatient } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { fileNameFor, fileStore } from '../files/fileStore';
import { runReport } from '../report/runner';
import { DATE_RANGE_LABELS, DATE_RANGE_PRESETS, DateRangePreset } from '../report/types';
import { useStudio } from '../state/store';
import { openTestWindow } from './TestWindow';

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
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; error?: boolean }>();
  const save = (asNew: boolean): void => {
    setSaving(true);
    void saveReport(asNew)
      .then((text) => text && setSaveMessage({ text }))
      .catch((e) => setSaveMessage({ text: `Save failed: ${e instanceof Error ? e.message : String(e)}`, error: true }))
      .finally(() => setSaving(false));
  };

  const running = run.status === 'fetching' || run.status === 'rendering';
  const instance = settings.zambdaBaseUrl.replace(/^https?:\/\//, '').replace(/\/local$/, '');
  const configured = Boolean(
    settings.zambdaBaseUrl && settings.accessToken && (settings.connection !== 'direct' || settings.apiKey)
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, bgcolor: 'primary.main', color: '#fff' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: 0.2, mr: 1 }}>
        Report Studio
      </Typography>
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
      {file.dirty && <Chip size="small" label="unsaved" sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }} />}
      {file.changedOnDisk && (
        <Tooltip title="The file changed on disk (another editor saved it). Open it again to reload.">
          <Chip size="small" color="warning" label="changed on disk" />
        </Tooltip>
      )}
      <Box sx={{ flex: 1 }} />
      {planNeedsPatient(report.plan) && (
        <Tooltip title="The plan uses {{patientId}}: the Patient this report runs for">
          <TextField
            value={report.parameters?.patientId ?? ''}
            onChange={(e) => setReport({ parameters: { ...report.parameters, patientId: e.target.value } })}
            placeholder="Patient id"
            sx={{ ...dateSx, width: 300, '& input::placeholder': { color: 'rgba(255,255,255,0.7)', opacity: 1 } }}
          />
        </Tooltip>
      )}
      <Select
        value={report.dateRange.preset}
        onChange={(e) => setReport({ dateRange: { ...report.dateRange, preset: e.target.value as DateRangePreset } })}
        size="small"
        variant="outlined"
        sx={{
          color: '#fff',
          minWidth: 150,
          '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
          '.MuiSvgIcon-root': { color: '#fff' },
        }}
      >
        {DATE_RANGE_PRESETS.map((p) => (
          <MenuItem key={p} value={p}>
            {DATE_RANGE_LABELS[p]}
          </MenuItem>
        ))}
      </Select>
      {report.dateRange.preset === 'custom' && (
        <>
          <TextField
            type="date"
            value={report.dateRange.start ?? ''}
            onChange={(e) => setReport({ dateRange: { ...report.dateRange, start: e.target.value } })}
            sx={dateSx}
          />
          <TextField
            type="date"
            value={report.dateRange.end ?? ''}
            onChange={(e) => setReport({ dateRange: { ...report.dateRange, end: e.target.value } })}
            sx={dateSx}
          />
        </>
      )}
      <Button
        variant="contained"
        color="secondary"
        startIcon={running ? <CircularProgress size={14} color="inherit" /> : <PlayArrowRoundedIcon />}
        disabled={running}
        onClick={() => void runReport()}
        sx={{ fontWeight: 600 }}
      >
        {running ? (run.status === 'fetching' ? 'Fetching…' : 'Rendering…') : 'Run'}
      </Button>
      <Button color="inherit" startIcon={<FolderOpenOutlinedIcon />} onClick={() => setOpenDialog(true)}>
        Open
      </Button>
      <Button
        color="inherit"
        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlinedIcon />}
        disabled={saving}
        onClick={() => save(false)}
      >
        Save
      </Button>
      <Tooltip title="Save under another name or in another place; later saves go to the new file">
        <span>
          <Button color="inherit" disabled={saving} onClick={() => save(true)}>
            Save as…
          </Button>
        </span>
      </Tooltip>
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
      <Tooltip title="Open this report in a new window and run it as a saved report would be opened, with no Claude">
        <span>
          <Button
            color="inherit"
            startIcon={<OpenInNewIcon />}
            onClick={() =>
              void openTestWindow().catch((e) =>
                useStudio
                  .getState()
                  .addEvent('error', `Test report failed: ${e instanceof Error ? e.message : String(e)}`)
              )
            }
          >
            Test report
          </Button>
        </span>
      </Tooltip>
      <Tooltip
        title={configured ? `Instance: ${instance} · ${settings.model}` : 'Set up the instance and Claude connection'}
      >
        <Button
          color="inherit"
          startIcon={<SettingsOutlinedIcon />}
          onClick={() => setSettingsOpen(true)}
          sx={{ color: configured ? '#fff' : '#ffd666' }}
        >
          {configured ? instance : 'Set up'}
        </Button>
      </Tooltip>
    </Box>
  );
}

const dateSx = {
  width: 150,
  '& input': { color: '#fff', py: 0.6 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
  '& input::-webkit-calendar-picker-indicator': { filter: 'invert(1)' },
};
