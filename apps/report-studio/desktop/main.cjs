// Report Studio desktop: the single-file studio (../dist/index.html, copied in as studio.html at package time) in an
// Electron window, plus the two things a browser page can't do:
//  - sign in to a practice with its own EHR login: the login opens in an app window and the code is taken from the
//    redirect to the EHR's usual address before that page loads (authorization code + PKCE, the EHR app's client id),
//    so no project needs a new sign-in app or a localhost return address;
//  - call Claude with the user's API key from this process (claude-relay://), which an org that refuses browser calls
//    still accepts — the studio's "Through local relay" connection, pointed at it.
const { app, BrowserWindow, ipcMain, net, protocol, session, shell } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const STUDIO_SCHEME = 'app';
const STUDIO_ORIGIN = `${STUDIO_SCHEME}://studio`;
const RELAY_SCHEME = 'claude-relay';
const ANTHROPIC = 'https://api.anthropic.com';
// Headers the page sends that must not reach Anthropic from here (as the local relay drops them).
const RELAY_DROP = new Set(['host', 'origin', 'referer', 'connection', 'content-length', 'anthropic-dangerous-direct-browser-access']);
const RELAY_CORS = {
  'access-control-allow-origin': STUDIO_ORIGIN,
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
};

protocol.registerSchemesAsPrivileged([
  // standard + secure: a stable origin, so localStorage, IndexedDB and the folder picker keep working between runs
  { scheme: STUDIO_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: RELAY_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const studioPage = () => {
  const packaged = path.join(__dirname, 'studio.html');
  return fs.existsSync(packaged) ? packaged : path.join(__dirname, '..', 'dist', 'index.html');
};

function serveStudio() {
  // Every path is the single-file page (the Test report window is the same page with #test-report).
  protocol.handle(STUDIO_SCHEME, () =>
    new Response(fs.readFileSync(studioPage()), { headers: { 'content-type': 'text/html; charset=utf-8' } })
  );
}

function serveRelay() {
  protocol.handle(RELAY_SCHEME, async (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: RELAY_CORS });
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, keyFromRelay: false, login: false }), {
        headers: { ...RELAY_CORS, 'content-type': 'application/json' },
      });
    }
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      if (!RELAY_DROP.has(key.toLowerCase())) headers.set(key, value);
    });
    const upstream = await net.fetch(`${ANTHROPIC}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: request.method === 'GET' ? undefined : await request.arrayBuffer(),
    });
    const out = new Headers(upstream.headers);
    for (const [key, value] of Object.entries(RELAY_CORS)) out.set(key, value);
    out.delete('content-encoding'); // net.fetch has already decoded the body
    out.delete('content-length');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  });
}

const base64url = (buffer) => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Opens the practice's login, waits for the redirect to `redirectUri` and exchanges the code for the user's token.
 * Resolves { accessToken, expiresIn }; rejects when the window is closed or the login answers with an error.
 */
async function signIn(parent, { domain, clientId, audience, connection, redirectUri }) {
  const verifier = base64url(crypto.randomBytes(32));
  const state = base64url(crypto.randomBytes(16));
  const authorize = new URL(`${domain.replace(/\/+$/, '')}/authorize`);
  const query = {
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    audience,
    scope: 'openid profile email',
    code_challenge: base64url(crypto.createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    state,
    ...(connection ? { connection } : {}),
  };
  for (const [key, value] of Object.entries(query)) authorize.searchParams.set(key, value);

  // A separate, non-persistent session: the login's cookies never mix with the studio's, and each sign-in is fresh.
  const login = new BrowserWindow({
    parent,
    modal: true,
    width: 480,
    height: 720,
    title: 'Sign in',
    webPreferences: { partition: `login-${Date.now()}`, sandbox: true },
  });

  const code = await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      fn();
      if (!login.isDestroyed()) login.close();
    };
    const intercept = (event, target) => {
      if (!target.startsWith(redirectUri)) return;
      event.preventDefault(); // the EHR page itself never loads here
      const params = new URL(target).searchParams;
      if (params.get('state') !== state) return finish(() => reject(new Error('Sign-in answered with an unexpected state.')));
      const error = params.get('error_description') || params.get('error');
      if (error || !params.get('code')) return finish(() => reject(new Error(`Sign-in failed: ${error || 'no code'}`)));
      finish(() => resolve(params.get('code')));
    };
    login.webContents.on('will-redirect', intercept);
    login.webContents.on('will-navigate', intercept);
    login.on('closed', () => finish(() => reject(new Error('The sign-in window was closed before signing in.'))));
    login.loadURL(authorize.toString()).catch(() => {}); // an aborted load (our intercept) rejects; nothing to do
  });

  const res = await net.fetch(`${domain.replace(/\/+$/, '')}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', client_id: clientId, code_verifier: verifier, code, redirect_uri: redirectUri }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Sign-in token exchange answered ${res.status}: ${body.error_description || 'no access token'}`);
  }
  return { accessToken: body.access_token, expiresIn: body.expires_in };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    title: 'Report Studio',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    // The Test report window is the studio itself; anything else (links in reports, docs) opens in the browser.
    if (url.startsWith(STUDIO_ORIGIN)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1280,
          height: 900,
          webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true },
        },
      };
    }
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  void win.loadURL(`${STUDIO_ORIGIN}/`);
}

app.whenReady().then(() => {
  serveStudio();
  serveRelay();
  // The studio's report folder (File System Access) asks for file-system permission; nothing else is granted.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(permission === 'fileSystem' || permission === 'clipboard-sanitized-write')
  );
  ipcMain.handle('studio:sign-in', (event, params) => signIn(BrowserWindow.fromWebContents(event.sender), params));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
