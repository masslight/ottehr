import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { planNeedsPatient } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { canSignIn, signIn, storedToken } from '../instance/login';
import { pickPatient } from '../report/pickPatient';
import { runReport } from '../report/runner';
import { DATE_RANGE_LABELS, StudioReport } from '../report/types';
import { RightTab, useStudio } from '../state/store';
import { Inspector } from './Inspector';
import { DataPanel } from './panels/DataPanel';
import { PlanPanel } from './panels/PlanPanel';
import { ReportPanel } from './panels/ReportPanel';

// "Test report": a second window that opens the report and runs it the way a saved report is opened later —
// the saved plan, code, date range, patient and fetch hints only, no chat and no Claude.
const TEST_HASH = '#test-report';
const READY = 'studio-test-ready';
const LOAD = 'studio-test-report';

export const isTestWindow = (): boolean => window.location.hash === TEST_HASH;

export async function openTestWindow(): Promise<void> {
  const { file, report, addEvent } = useStudio.getState();
  // The in-memory report is exactly what Save writes (plus updatedAt), so unsaved changes are tested too.
  const saved: StudioReport = report;
  const child = window.open(
    `${window.location.href.split('#')[0]}${TEST_HASH}`,
    '_blank',
    'popup,width=1280,height=900'
  );
  if (!child) {
    addEvent('error', 'The browser blocked the test window; allow pop-ups for this page.');
    return;
  }
  const onMessage = (e: MessageEvent): void => {
    if (e.source !== child || e.data?.type !== READY) return;
    window.removeEventListener('message', onMessage);
    // file:// pages have an opaque origin, so '*' is the only target that reaches the child.
    child.postMessage({ type: LOAD, report: saved, fileName: file.fileName }, '*');
  };
  window.addEventListener('message', onMessage);
  addEvent('file', `Testing ${file.fileName ?? saved.name} in a new window`);
}

// The environment this window last ran against, remembered on its own key so it never overwrites the builder's settings.
const TEST_ENV_KEY = 'reportStudio.testEnvironment';

// '' = the builder's own instance (Settings → Instance).
function selectEnvironment(name: string): void {
  const { settings, setTestTarget, setRun } = useStudio.getState();
  const target = settings.environments.find((env) => env.name === name);
  setTestTarget(target);
  // The last result came from the other instance; never show it under this one's name.
  setRun({ status: 'idle' });
  try {
    localStorage.setItem(TEST_ENV_KEY, target ? name : '');
  } catch {
    // Only a convenience: the next window starts on the builder instance.
  }
}

function rememberedEnvironment(): string {
  try {
    return localStorage.getItem(TEST_ENV_KEY) ?? '';
  } catch {
    return '';
  }
}

const whiteOutline = {
  color: '#fff',
  '& input': { color: '#fff', py: 0.6 },
  '.MuiOutlinedInput-notchedOutline, & .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline, & .Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#fff',
  },
  '.MuiSvgIcon-root': { color: '#fff' },
  '& input::placeholder': { color: 'rgba(255,255,255,0.7)', opacity: 1 },
};

const TABS: { id: RightTab; label: string }[] = [
  { id: 'report', label: 'Report' },
  { id: 'plan', label: 'Plan' },
  { id: 'data', label: 'Data' },
];

export function TestApp(): React.ReactElement {
  const report = useStudio((s) => s.report);
  const file = useStudio((s) => s.file);
  const run = useStudio((s) => s.run);
  const tab = useStudio((s) => s.tab);
  const setTab = useStudio((s) => s.setTab);
  const settings = useStudio((s) => s.settings);
  const testTarget = useStudio((s) => s.testTarget);
  const [signingIn, setSigningIn] = useState(false);
  const [moreThan, setMoreThan] = useState('2');
  const [picking, setPicking] = useState(false);
  // Shown beside the button (the Inspector may be closed): progress while picking, then the outcome.
  const [pickStatus, setPickStatus] = useState<{ text: string; error?: boolean }>();
  const startPick = (): void => {
    const min = Math.max(0, Number(moreThan) || 0);
    const { addEvent } = useStudio.getState();
    const say = (text: string, kind: 'info' | 'warn' | 'error'): void => {
      setPickStatus({ text, error: kind === 'error' });
      addEvent(kind, text);
    };
    const startedAt = Date.now();
    const took = (): string => `${Math.round((Date.now() - startedAt) / 1000)} s`;
    setPicking(true);
    setPickStatus({ text: 'Searching vitals…' });
    addEvent('fetch', `Looking for a patient with more than ${min} visits with vitals (last 90 days, then last year)…`);
    pickPatient(min, (text) => setPickStatus({ text }))
      .then((picked) => {
        if (picked.patientId === undefined) {
          say(
            `No patient has more than ${min} visits with vitals in ${picked.period} (the most is ${
              picked.mostVisits
            }; ${took()})`,
            'warn'
          );
          return;
        }
        useStudio
          .getState()
          .setReport({ parameters: { ...useStudio.getState().report.parameters, patientId: picked.patientId } });
        say(`Picked: ${picked.visits} visits with vitals in ${picked.period} (${took()})`, 'info');
      })
      .catch((e: unknown) => say(`Pick patient failed: ${e instanceof Error ? e.message : String(e)}`, 'error'))
      .finally(() => setPicking(false));
  };
  const needsSignIn = !!testTarget && canSignIn(testTarget) && !storedToken(testTarget) && !testTarget.accessToken;
  const startSignIn = (): void => {
    if (!testTarget) return;
    setSigningIn(true);
    signIn(testTarget)
      .then((accessToken) => useStudio.getState().setTestTarget({ ...testTarget, accessToken }))
      .catch((e: unknown) => useStudio.getState().addEvent('error', e instanceof Error ? e.message : String(e)))
      .finally(() => setSigningIn(false));
  };
  const setReport = useStudio((s) => s.setReport);
  const running = run.status === 'fetching' || run.status === 'rendering';
  const fetchMs = running ? undefined : run.fetch?.totalMs;

  useEffect(() => {
    const onMessage = (e: MessageEvent): void => {
      if (e.source !== window.opener || e.data?.type !== LOAD) return;
      useStudio.getState().replaceReport(e.data.report as StudioReport, { fileName: e.data.fileName, dirty: false });
      document.title = `Test: ${(e.data.report as StudioReport).name}`;
      selectEnvironment(rememberedEnvironment());
      // Another environment waits for Run: its patient id is not the one the report was built with.
      if (!useStudio.getState().testTarget) void runReport();
    };
    window.addEventListener('message', onMessage);
    window.opener?.postMessage({ type: READY }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, bgcolor: 'primary.main', color: '#fff' }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Test report
        </Typography>
        <Typography sx={{ fontWeight: 500 }}>{report.name}</Typography>
        <Chip size="small" label="as saved · no Claude" sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }} />
        {testTarget?.production && <Chip size="small" color="error" label="Production · real patient data" />}
        <Box sx={{ flex: 1 }} />
        {file.fileName && <Typography variant="caption">{file.fileName}</Typography>}
        <Select
          value={testTarget?.name ?? ''}
          onChange={(e) => selectEnvironment(e.target.value)}
          displayEmpty
          disabled={running}
          size="small"
          sx={{ ...whiteOutline, minWidth: 200 }}
        >
          <MenuItem value="">Builder instance ({settings.zambdaBaseUrl})</MenuItem>
          {settings.environments.map((env) => (
            <MenuItem key={env.name} value={env.name}>
              {env.name}
              {env.production ? ' (production)' : ''}
            </MenuItem>
          ))}
        </Select>
        {planNeedsPatient(report.plan) && (
          <TextField
            value={report.parameters?.patientId ?? ''}
            onChange={(e) => setReport({ parameters: { ...report.parameters, patientId: e.target.value } })}
            placeholder="Patient id"
            disabled={running}
            size="small"
            sx={{ ...whiteOutline, width: 300 }}
          />
        )}
        {planNeedsPatient(report.plan) && (
          <>
            <TextField
              value={moreThan}
              onChange={(e) => setMoreThan(e.target.value.replace(/\D/g, ''))}
              label="more than … visits"
              disabled={running || picking}
              size="small"
              sx={{ ...whiteOutline, width: 120, '& label': { color: 'rgba(255,255,255,0.7)' } }}
            />
            <Button
              variant="outlined"
              color="inherit"
              disabled={running || picking || needsSignIn || !window.opener}
              onClick={startPick}
              startIcon={picking ? <CircularProgress size={14} color="inherit" /> : undefined}
              // a disabled outlined button is near-invisible on the dark bar; keep it readable while picking
              sx={{ '&.Mui-disabled': { color: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.4)' } }}
            >
              {picking ? 'Picking…' : 'Pick patient'}
            </Button>
            {pickStatus && (
              <Typography
                variant="caption"
                title={pickStatus.text}
                sx={{
                  maxWidth: 360,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  ...(pickStatus.error && { bgcolor: 'error.main', px: 0.75, py: 0.25, borderRadius: 0.5 }),
                }}
              >
                {pickStatus.text}
              </Typography>
            )}
          </>
        )}
        <Typography variant="caption">{DATE_RANGE_LABELS[report.dateRange.preset]}</Typography>
        {fetchMs !== undefined && <Typography variant="caption">fetch {(fetchMs / 1000).toFixed(1)} s</Typography>}
        {needsSignIn && (
          <Button
            variant="contained"
            color="inherit"
            sx={{ color: 'primary.main' }}
            disabled={signingIn}
            onClick={startSignIn}
          >
            {signingIn ? 'Signing in…' : `Sign in to ${testTarget?.name}`}
          </Button>
        )}
        <Button
          variant="contained"
          color="secondary"
          startIcon={running ? <CircularProgress size={14} color="inherit" /> : <PlayArrowRoundedIcon />}
          disabled={running || !window.opener || needsSignIn}
          onClick={() => void runReport()}
        >
          {running
            ? run.status === 'fetching'
              ? 'Fetching…'
              : 'Rendering…'
            : run.status === 'idle'
            ? 'Run'
            : 'Run again'}
        </Button>
      </Box>
      {!window.opener && (
        <Typography sx={{ p: 2 }}>Open this window with the Test report button in Report Studio.</Typography>
      )}
      <Paper variant="outlined" sx={{ flex: 1, m: 1.5, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Tabs
          value={tab === 'code' ? 'report' : tab}
          onChange={(_, v) => setTab(v as RightTab)}
          sx={{ minHeight: 40, px: 1 }}
        >
          {TABS.map((t) => (
            <Tab key={t.id} value={t.id} label={t.label} sx={{ minHeight: 40, py: 0 }} />
          ))}
        </Tabs>
        <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: tab === 'plan' || tab === 'data' ? 'none' : 'block',
              overflow: 'auto',
            }}
          >
            <ReportPanel />
          </Box>
          {tab === 'plan' && <PlanPanel />}
          {tab === 'data' && <DataPanel />}
        </Box>
        <Inspector />
      </Paper>
    </Box>
  );
}
