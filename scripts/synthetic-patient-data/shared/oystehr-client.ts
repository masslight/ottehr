// Shared M2M auth + Oystehr client construction for the synthetic-data dev scripts.
//
// Credentials come from the environment (populated via
// `npx env-cmd -f packages/zambdas/.env/<env>.json …`) — never inline secrets.
//
// This replaces the token-mint + `new Oystehr({...})` block that was copy-pasted
// across ~50 scripts. Beyond de-duplication it also hardens the original pattern,
// which silently produced a client with `accessToken: undefined` when the token
// request failed; here a failed/empty token throws immediately.
import Oystehr from '@oystehr/sdk';

/** Read a required env var or throw. (Config errors in dev tooling — fine to throw raw.) */
export const need = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
};

/** Mint an M2M access token from the AUTH0_* client-credentials env vars. */
export const mintAccessToken = async (): Promise<string> => {
  const res = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: need('AUTH0_CLIENT'),
      client_secret: need('AUTH0_SECRET'),
      audience: need('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    throw new Error(`M2M token request failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error('M2M token response contained no access_token');
  }
  return body.access_token;
};

/** Construct an Oystehr SDK client from an already-minted access token (no extra token request). */
export const createOystehrFromToken = (accessToken: string): Oystehr =>
  new Oystehr({
    accessToken,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

/** Construct an Oystehr SDK client for the target project, authenticated via M2M env creds. */
export const createOystehrFromEnv = async (): Promise<Oystehr> => createOystehrFromToken(await mintAccessToken());
