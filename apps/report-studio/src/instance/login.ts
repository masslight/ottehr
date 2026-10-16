// Sign in to an environment the way the EHR does, in a popup: the Oystehr login page of that project's
// "Report Studio" app (config/oystehr-core/apps.json REPORT_STUDIO), authorization code + PKCE, back to
// {studio origin}/callback. Needs the studio served from STUDIO_ORIGIN (serve-studio.mjs), the only callback
// the app allows. The token is the signed-in user's own, kept per environment in this browser until it expires.
import type { Environment } from '../state/store';

export const STUDIO_ORIGIN = 'http://localhost:5199';
const CALLBACK_PATH = '/callback';
export const DEFAULT_LOGIN_DOMAIN = 'https://auth.zapehr.com';
export const DEFAULT_LOGIN_AUDIENCE = 'https://api.zapehr.com';
const CALLBACK_MESSAGE = 'studio-login-callback';
const TOKEN_KEY = (env: string): string => `reportStudio.token.${env}`;
// Treat a token as expired a minute early, so a run never starts on one about to lapse.
const EXPIRY_MARGIN_MS = 60_000;

interface DesktopBridge {
  relayUrl: string;
  signIn(params: {
    domain: string;
    clientId: string;
    audience: string;
    connection?: string;
    redirectUri: string;
  }): Promise<{ accessToken: string; expiresIn?: number }>;
}
/** Set inside the desktop app (desktop/preload.cjs). */
export const desktop = (): DesktopBridge | undefined =>
  (window as unknown as { reportStudioDesktop?: DesktopBridge }).reportStudioDesktop;

/** Desktop: the EHR's own login, caught at its return address. Browser: the project's Report Studio app. */
export const canSignIn = (env: Environment | undefined): boolean =>
  !!env?.loginClientId && (!desktop() || !!env.loginRedirectUri);
export const servedFromStudioOrigin = (): boolean => !!desktop() || window.location.origin === STUDIO_ORIGIN;

export function storedToken(env: Environment): string | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY(env.name)) ?? 'null') as {
      token: string;
      expiresAt: number;
    } | null;
    return saved && saved.expiresAt - EXPIRY_MARGIN_MS > Date.now() ? saved.token : undefined;
  } catch {
    return undefined;
  }
}

export function signOut(env: Environment): void {
  try {
    localStorage.removeItem(TOKEN_KEY(env.name));
  } catch {
    // nothing stored
  }
}

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const randomString = (): string => base64url(crypto.getRandomValues(new Uint8Array(32)));

/** In the popup, on {origin}/callback: hand the code to the studio window that opened it, then close. */
export function handleLoginCallback(): boolean {
  if (window.location.pathname !== CALLBACK_PATH) return false;
  const params = new URLSearchParams(window.location.search);
  window.opener?.postMessage(
    {
      type: CALLBACK_MESSAGE,
      code: params.get('code'),
      state: params.get('state'),
      error: params.get('error_description') ?? params.get('error'),
    },
    window.location.origin
  );
  window.close();
  return true;
}

function remember(env: Environment, token: string, expiresIn: number | undefined): void {
  try {
    localStorage.setItem(
      TOKEN_KEY(env.name),
      JSON.stringify({ token, expiresAt: Date.now() + (expiresIn ?? 3600) * 1000 })
    );
  } catch {
    // Not stored: this window still has it for this run.
  }
}

/** Opens the environment's login in a popup and resolves with its access token once the user has signed in. */
export async function signIn(env: Environment): Promise<string> {
  const app = desktop();
  if (app) {
    if (!env.loginClientId || !env.loginRedirectUri)
      throw new Error(`${env.name} needs the EHR's client id and address (Settings → Test environments).`);
    const { accessToken, expiresIn } = await app
      .signIn({
        domain: env.loginDomain || DEFAULT_LOGIN_DOMAIN,
        clientId: env.loginClientId,
        audience: env.loginAudience || DEFAULT_LOGIN_AUDIENCE,
        connection: env.loginConnection,
        redirectUri: env.loginRedirectUri,
      })
      // Electron wraps errors from the app process as "Error invoking remote method …: Error: <message>".
      .catch((e: unknown) => {
        throw new Error(
          String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
        );
      });
    remember(env, accessToken, expiresIn);
    return accessToken;
  }
  if (!servedFromStudioOrigin())
    throw new Error(`Sign-in works only when the studio is opened from ${STUDIO_ORIGIN} (serve-studio.mjs).`);
  if (!env.loginClientId) throw new Error(`${env.name} has no Report Studio client id (Settings → Test environments).`);
  const domain = (env.loginDomain || DEFAULT_LOGIN_DOMAIN).replace(/\/+$/, '');
  const redirectUri = `${STUDIO_ORIGIN}${CALLBACK_PATH}`;
  const verifier = randomString();
  const state = randomString();
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  );
  const authorize = new URL(`${domain}/authorize`);
  for (const [key, value] of Object.entries({
    response_type: 'code',
    client_id: env.loginClientId,
    redirect_uri: redirectUri,
    audience: env.loginAudience || DEFAULT_LOGIN_AUDIENCE,
    scope: 'openid profile email',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    ...(env.loginConnection ? { connection: env.loginConnection } : {}),
  }))
    authorize.searchParams.set(key, value);

  const popup = window.open(authorize.toString(), 'studio-login', 'popup,width=480,height=720');
  if (!popup) throw new Error('The browser blocked the sign-in window; allow pop-ups for this page.');

  const code = await new Promise<string>((resolve, reject) => {
    const closed = window.setInterval(() => {
      if (popup.closed) finish(() => reject(new Error('The sign-in window was closed before signing in.')));
    }, 500);
    const onMessage = (e: MessageEvent): void => {
      if (e.origin !== window.location.origin || e.source !== popup || e.data?.type !== CALLBACK_MESSAGE) return;
      if (e.data.state !== state) return finish(() => reject(new Error('Sign-in answered with an unexpected state.')));
      if (e.data.error || !e.data.code) return finish(() => reject(new Error(`Sign-in failed: ${e.data.error}`)));
      finish(() => resolve(e.data.code as string));
    };
    const finish = (settle: () => void): void => {
      window.clearInterval(closed);
      window.removeEventListener('message', onMessage);
      settle();
    };
    window.addEventListener('message', onMessage);
  });

  const res = await fetch(`${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: env.loginClientId,
      code_verifier: verifier,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !body.access_token)
    throw new Error(`Sign-in token exchange answered ${res.status}: ${body.error_description ?? 'no access token'}`);
  remember(env, body.access_token, body.expires_in);
  return body.access_token;
}
