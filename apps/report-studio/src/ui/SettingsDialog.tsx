import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { EFFORTS, Effort, MODEL_IDS, MODEL_LABELS, ModelId } from '../llm/models';
import { useStudio } from '../state/store';

export function SettingsDialog(): React.ReactElement {
  const open = useStudio((s) => s.settingsOpen);
  const setOpen = useStudio((s) => s.setSettingsOpen);
  const settings = useStudio((s) => s.settings);
  const setSettings = useStudio((s) => s.setSettings);
  const [relayStatus, setRelayStatus] = useState<string | null>(null);
  const [instanceStatus, setInstanceStatus] = useState<string | null>(null);

  const testRelay = async (): Promise<void> => {
    setRelayStatus('checking…');
    try {
      const res = await fetch(`${settings.relayUrl.replace(/\/+$/, '')}/health`);
      // Form Studio's relay answers the same way (keyFromRelay); either relay serves both studios.
      const body = (await res.json()) as { ok?: boolean; keyFromEnv?: boolean; keyFromRelay?: boolean };
      const hasKey = body.keyFromEnv || body.keyFromRelay;
      setRelayStatus(
        body.ok
          ? `relay is up${hasKey ? ' and holds a key (no key needed here)' : ' — it forwards the key you enter here'}`
          : 'unexpected answer'
      );
    } catch {
      setRelayStatus('not reachable — start it with: node apps/report-studio/scripts/claude-relay.mjs');
    }
  };

  const testInstance = async (): Promise<void> => {
    setInstanceStatus('checking…');
    try {
      const res = await fetch(`${settings.zambdaBaseUrl.replace(/\/+$/, '')}/zambda/list-adhoc-reports/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.accessToken}` },
        body: '{}',
      });
      const body = (await res.json().catch(() => ({}))) as { output?: { reports?: unknown[]; message?: string } };
      if (res.ok) setInstanceStatus(`connected — ${body.output?.reports?.length ?? 0} saved report(s) on the instance`);
      else setInstanceStatus(`answered ${res.status}: ${body.output?.message ?? 'check the token'}`);
    } catch {
      setInstanceStatus('not reachable — is the zambda server running on that port?');
    }
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Instance
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label="Zambda base URL"
                value={settings.zambdaBaseUrl}
                onChange={(e) => setSettings({ zambdaBaseUrl: e.target.value })}
                helperText="Zambdas are called at {base}/zambda/{name}/execute. Local synth server: http://localhost:3005/local"
                fullWidth
              />
              <TextField
                label="Access token"
                type="password"
                value={settings.accessToken}
                onChange={(e) => setSettings({ accessToken: e.target.value })}
                helperText="A bearer token with the Administrator role: copy one from an EHR session (DevTools → Network → any zambda call → Authorization), or an M2M token. Stored in this browser only."
                fullWidth
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Button variant="outlined" onClick={() => void testInstance()}>
                  Test instance
                </Button>
                {instanceStatus && <Typography variant="caption">{instanceStatus}</Typography>}
              </Stack>
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Claude
            </Typography>
            <Stack spacing={1.5}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={settings.connection}
                onChange={(_, v) => v && setSettings({ connection: v as 'relay' | 'direct' })}
              >
                <ToggleButton value="relay">Through local relay</ToggleButton>
                <ToggleButton value="direct">Direct from browser</ToggleButton>
              </ToggleButtonGroup>
              {settings.connection === 'relay' ? (
                <>
                  <Alert severity="info" sx={{ py: 0 }}>
                    Masslight's Anthropic org rejects browser (CORS) requests, so calls go through a tiny local relay:{' '}
                    <code>node apps/report-studio/scripts/claude-relay.mjs</code>. Give it{' '}
                    <code>ANTHROPIC_API_KEY</code> in its environment and leave the key below empty, or enter the key
                    here and the relay forwards it.
                  </Alert>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      label="Relay URL"
                      value={settings.relayUrl}
                      onChange={(e) => setSettings({ relayUrl: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                    <Button variant="outlined" onClick={() => void testRelay()}>
                      Test relay
                    </Button>
                  </Stack>
                  {relayStatus && <Typography variant="caption">{relayStatus}</Typography>}
                </>
              ) : (
                <Alert severity="warning" sx={{ py: 0 }}>
                  Direct calls need an org that allows browser access; otherwise the API answers 401 and you should
                  switch to the relay.
                </Alert>
              )}
              <TextField
                label={
                  settings.connection === 'relay'
                    ? 'Anthropic API key (optional if the relay has one)'
                    : 'Anthropic API key'
                }
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ apiKey: e.target.value })}
                helperText="Stored in this browser's localStorage only; never written into a report file."
                fullWidth
              />
              <Stack direction="row" spacing={1.5}>
                <TextField
                  select
                  label="Model"
                  value={settings.model}
                  onChange={(e) => setSettings({ model: e.target.value as ModelId })}
                  sx={{ flex: 1 }}
                >
                  {MODEL_IDS.map((m) => (
                    <MenuItem key={m} value={m}>
                      {MODEL_LABELS[m]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Effort"
                  value={settings.effort}
                  onChange={(e) => setSettings({ effort: e.target.value as Effort })}
                  sx={{ width: 140 }}
                >
                  {EFFORTS.map((e) => (
                    <MenuItem key={e} value={e}>
                      {e}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.allowUnredactedSamples}
                    onChange={(e) => setSettings({ allowUnredactedSamples: e.target.checked })}
                  />
                }
                label={
                  <Typography variant="body2">
                    Send unredacted sample resources to Claude{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      (synthetic data only — off strips names, contacts, birth dates, identifiers and free text)
                    </Typography>
                  </Typography>
                }
              />
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Report runtime
            </Typography>
            <TextField
              label="MUI X license key (optional)"
              type="password"
              value={settings.muiLicenseKey}
              onChange={(e) => setSettings({ muiLicenseKey: e.target.value })}
              helperText="Removes the DataGrid Pro watermark in report tables; the EHR's VITE_APP_MUI_X_LICENSE_KEY."
              fullWidth
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, pl: 1 }}>
          Built {__BUILD_TIME__.slice(0, 16).replace('T', ' ')} UTC
        </Typography>
        <Button variant="contained" onClick={() => setOpen(false)}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
