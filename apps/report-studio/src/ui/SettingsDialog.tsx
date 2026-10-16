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
import { Effort, EFFORTS, MODEL_IDS, MODEL_LABELS, ModelId } from '../llm/models';
import {
  canSignIn,
  desktop,
  servedFromStudioOrigin,
  signIn,
  signOut,
  STUDIO_ORIGIN,
  storedToken,
} from '../instance/login';
import { Environment, Settings, useStudio } from '../state/store';

async function checkInstance(zambdaBaseUrl: string, accessToken: string): Promise<string> {
  try {
    const res = await fetch(`${zambdaBaseUrl.replace(/\/+$/, '')}/zambda/list-adhoc-reports/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: '{}',
    });
    const body = (await res.json().catch(() => ({}))) as { output?: { reports?: unknown[]; message?: string } };
    if (res.ok) return `connected — ${body.output?.reports?.length ?? 0} saved report(s) on the instance`;
    return `answered ${res.status}: ${body.output?.message ?? 'check the token'}`;
  } catch {
    return 'not reachable — is the zambda server running on that port?';
  }
}

const NEW_ENVIRONMENT: Environment = {
  name: '',
  zambdaBaseUrl: 'http://localhost:3006/local',
  accessToken: '',
  production: false,
};

function EnvironmentsSection(): React.ReactElement {
  const environments = useStudio((s) => s.settings.environments);
  const setSettings = useStudio((s) => s.setSettings);
  const [status, setStatus] = useState<Record<number, string>>({});
  const update = (index: number, patch: Partial<Environment>): void =>
    setSettings({ environments: environments.map((env, i) => (i === index ? { ...env, ...patch } : env)) });
  const say = (i: number, message: string): void => setStatus((s) => ({ ...s, [i]: message }));

  const test = async (i: number, env: Environment): Promise<void> => {
    const token = canSignIn(env) ? storedToken(env) : env.accessToken;
    if (!token) return say(i, canSignIn(env) ? 'not signed in — press Sign in' : 'no access token');
    say(i, 'checking…');
    say(i, await checkInstance(env.zambdaBaseUrl, token));
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Test environments
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
        Instances the Test report window can run against; the builder and Claude always use the instance above. Each is
        a local zambda server from this worktree started for that project:{' '}
        <code>
          sh ~/development/documents/report-studio/start-env-server.sh &lt;project&gt; &lt;env&gt; &lt;port&gt;
        </code>
        . With the project's Report Studio client id set, you sign in with your own login in a popup (needs the studio
        opened from {STUDIO_ORIGIN}); otherwise paste an access token. Tokens stay in this browser.
      </Typography>
      {!servedFromStudioOrigin() && (
        <Alert severity="info" sx={{ py: 0, mb: 1 }}>
          Sign-in needs the studio at {STUDIO_ORIGIN}:{' '}
          <code>node ~/development/documents/report-studio/serve-studio.mjs</code>
        </Alert>
      )}
      <Stack spacing={1.5}>
        {environments.map((env, i) => (
          <Stack key={i} spacing={1} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Name"
                size="small"
                value={env.name}
                onChange={(e) => update(i, { name: e.target.value })}
                sx={{ width: 170 }}
              />
              <TextField
                label="Zambda base URL"
                size="small"
                value={env.zambdaBaseUrl}
                onChange={(e) => update(i, { zambdaBaseUrl: e.target.value })}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField
                label={desktop() ? 'EHR client id' : 'Report Studio client id'}
                size="small"
                value={env.loginClientId ?? ''}
                onChange={(e) => update(i, { loginClientId: e.target.value.trim() || undefined })}
                helperText={
                  desktop()
                    ? "The EHR's VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID (not a secret)"
                    : "The project's Report Studio app (not a secret)"
                }
                sx={{ flex: 1 }}
              />
              <TextField
                label="Login connection (optional)"
                size="small"
                value={env.loginConnection ?? ''}
                onChange={(e) => update(i, { loginConnection: e.target.value.trim() || undefined })}
                helperText="Only if the EHR uses one"
                sx={{ width: 190 }}
              />
            </Stack>
            {desktop() && (
              <TextField
                label="EHR address"
                size="small"
                value={env.loginRedirectUri ?? ''}
                onChange={(e) => update(i, { loginRedirectUri: e.target.value.trim() || undefined })}
                helperText="Where the EHR's login returns, e.g. https://ehr.example.com (VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL)"
                fullWidth
              />
            )}
            {!canSignIn(env) && (
              <TextField
                label="Access token"
                type="password"
                size="small"
                value={env.accessToken}
                onChange={(e) => update(i, { accessToken: e.target.value })}
                fullWidth
              />
            )}
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControlLabel
                control={
                  <Switch checked={env.production} onChange={(e) => update(i, { production: e.target.checked })} />
                }
                label={<Typography variant="body2">Production (real patient data)</Typography>}
              />
              <Box sx={{ flex: 1 }} />
              {canSignIn(env) &&
                (storedToken(env) ? (
                  <Button
                    size="small"
                    onClick={() => {
                      signOut(env);
                      say(i, 'signed out');
                    }}
                  >
                    Sign out
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="contained"
                    disabled={!servedFromStudioOrigin()}
                    onClick={() =>
                      void signIn(env).then(
                        () => say(i, 'signed in'),
                        (e: unknown) => say(i, e instanceof Error ? e.message : String(e))
                      )
                    }
                  >
                    Sign in
                  </Button>
                ))}
              <Button size="small" variant="outlined" onClick={() => void test(i, env)}>
                Test
              </Button>
              <Button
                size="small"
                color="error"
                onClick={() => {
                  setStatus({});
                  signOut(env);
                  setSettings({ environments: environments.filter((_, j) => j !== i) });
                }}
              >
                Remove
              </Button>
            </Stack>
            {status[i] && <Typography variant="caption">{status[i]}</Typography>}
          </Stack>
        ))}
        <Box>
          <Button
            size="small"
            onClick={() =>
              setSettings({
                environments: [...environments, { ...NEW_ENVIRONMENT, name: `environment ${environments.length + 1}` }],
              })
            }
          >
            Add environment
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

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
      const body = (await res.json()) as {
        ok?: boolean;
        keyFromEnv?: boolean;
        keyFromRelay?: boolean;
        login?: boolean;
      };
      const hasKey = body.keyFromEnv || body.keyFromRelay;
      if (!body.ok) setRelayStatus('unexpected answer');
      else if (settings.connection === 'login')
        setRelayStatus(
          body.login
            ? 'relay is up and can use your Claude login'
            : 'relay is up, but the Claude Agent SDK is not installed next to it — start it with start-relay-login.sh'
        );
      else
        setRelayStatus(
          `relay is up${hasKey ? ' and holds a key (no key needed here)' : ' — it forwards the key you enter here'}`
        );
    } catch {
      setRelayStatus(
        settings.connection === 'login'
          ? 'not reachable — start it with: sh ~/development/documents/form-studio/start-relay-login.sh'
          : 'not reachable — start it with: node apps/report-studio/scripts/claude-relay.mjs'
      );
    }
  };

  const testInstance = async (): Promise<void> => {
    setInstanceStatus('checking…');
    setInstanceStatus(await checkInstance(settings.zambdaBaseUrl, settings.accessToken));
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

          <EnvironmentsSection />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Claude
            </Typography>
            <Stack spacing={1.5}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={settings.connection}
                onChange={(_, v) => v && setSettings({ connection: v as Settings['connection'] })}
              >
                <ToggleButton value="relay">Through local relay</ToggleButton>
                <ToggleButton value="direct">Direct from browser</ToggleButton>
                <ToggleButton value="login">Through my Claude login (this Mac)</ToggleButton>
              </ToggleButtonGroup>
              {settings.connection !== 'direct' ? (
                <>
                  {settings.connection === 'login' ? (
                    <Alert severity="info" sx={{ py: 0 }}>
                      No API key: the relay runs each turn with the Claude Agent SDK, signed in as the Claude Code login
                      on this Mac (the one <code>claude</code> uses), so usage counts against that subscription. Start
                      it with <code>sh ~/development/documents/form-studio/start-relay-login.sh</code> (one relay serves
                      both studios). Only works on a Mac where Claude Code is logged in; the chat history lives in that
                      login's session files, so switching connection starts a fresh conversation.
                    </Alert>
                  ) : (
                    <Alert severity="info" sx={{ py: 0 }}>
                      Masslight's Anthropic org rejects browser (CORS) requests, so calls go through a tiny local relay:{' '}
                      <code>node apps/report-studio/scripts/claude-relay.mjs</code>. Give it{' '}
                      <code>ANTHROPIC_API_KEY</code> in its environment and leave the key below empty, or enter the key
                      here and the relay forwards it.
                    </Alert>
                  )}
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
              {settings.connection !== 'login' && (
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
              )}
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
