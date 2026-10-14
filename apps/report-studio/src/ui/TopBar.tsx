import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  InputBase,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { fileNameFor, fileStore } from '../files/fileStore';
import { runReport } from '../report/runner';
import { DATE_RANGE_LABELS, DATE_RANGE_PRESETS, DateRangePreset } from '../report/types';
import { useStudio } from '../state/store';

export async function saveReport(): Promise<void> {
  const { report, file, setFile, setReport, addEvent } = useStudio.getState();
  const stamped = { ...report, updatedAt: new Date().toISOString() };
  const fileName = file.fileName ?? fileNameFor(report.name);
  try {
    if (file.mode === 'folder') {
      await fileStore.writeReport(fileName, stamped);
      setFile({ fileName, dirty: false, changedOnDisk: false, files: await fileStore.listReports() });
    } else if (!(await fileStore.saveToPickedFile(stamped))) {
      fileStore.download(fileName, stamped);
      setFile({ fileName, dirty: false });
    } else setFile({ fileName, dirty: false });
    setReport({ updatedAt: stamped.updatedAt }, { dirty: false });
    addEvent('file', `Saved ${fileName}`);
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
        onClick={() => {
          setSaving(true);
          void saveReport()
            .catch(() => undefined)
            .finally(() => setSaving(false));
        }}
      >
        Save
      </Button>
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
