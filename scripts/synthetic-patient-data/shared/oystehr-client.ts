// Shared M2M auth + Oystehr client construction for the synthetic-data dev scripts.
//
// Credentials come from the environment (populated via
// `npx env-cmd -f packages/zambdas/.env/<env>.json …`) or, for the copy-between-
// projects scripts, directly from an env-file path — never inline secrets.
//
// This replaces the token-mint + `new Oystehr({...})` block that was copy-pasted
// across ~50 scripts. Beyond de-duplication it also hardens the original pattern,
// which silently produced a client with `accessToken: undefined` when the token
// request failed; here a failed/empty token throws immediately.
import Oystehr from '@oystehr/sdk';
import { readFileSync } from 'fs';

/** Read a required env var or throw. (Config errors in dev tooling — fine to throw raw.) */
export const need = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
};

/** The M2M credential shape shared by process.env and the .env/<env>.json files. */
export interface OystehrEnvConfig {
  AUTH0_ENDPOINT: string;
  AUTH0_CLIENT: string;
  AUTH0_SECRET: string;
  AUTH0_AUDIENCE: string;
  PROJECT_ID: string;
  PROJECT_API: string;
  /** Optional: point the SDK's zambda client somewhere specific (e.g. the local zambda server). */
  ZAMBDA_API?: string;
}

const REQUIRED_ENV_KEYS = [
  'AUTH0_ENDPOINT',
  'AUTH0_CLIENT',
  'AUTH0_SECRET',
  'AUTH0_AUDIENCE',
  'PROJECT_ID',
  'PROJECT_API',
] as const;

/** Load + validate an .env/<env>.json credential file (all required keys present). */
export const loadEnvFile = (path: string): OystehrEnvConfig => {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, string | undefined>;
  for (const key of REQUIRED_ENV_KEYS) {
    if (!raw[key]) throw new Error(`${path} is missing required key: ${key}`);
  }
  return raw as unknown as OystehrEnvConfig;
};

/**
 * OAuth 2.0 client-credentials exchange against Oystehr IAM (env var names are
 * AUTH0_* for compatibility with the broader Ottehr .env files). Throws on a
 * non-2xx response or a response with no access_token — never returns undefined.
 */
type TokenConfig = Pick<OystehrEnvConfig, 'AUTH0_ENDPOINT' | 'AUTH0_CLIENT' | 'AUTH0_SECRET' | 'AUTH0_AUDIENCE'>;

const requestAccessToken = async (config: TokenConfig, label?: string): Promise<string> => {
  const prefix = label ? `[${label}] ` : '';
  const res = await fetch(config.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.AUTH0_CLIENT,
      client_secret: config.AUTH0_SECRET,
      audience: config.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    throw new Error(`${prefix}M2M token request failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error(`${prefix}M2M token response contained no access_token`);
  }
  return body.access_token;
};

/** Mint an M2M access token from the AUTH0_* client-credentials env vars. */
export const mintAccessToken = async (): Promise<string> =>
  requestAccessToken({
    AUTH0_ENDPOINT: need('AUTH0_ENDPOINT'),
    AUTH0_CLIENT: need('AUTH0_CLIENT'),
    AUTH0_SECRET: need('AUTH0_SECRET'),
    AUTH0_AUDIENCE: need('AUTH0_AUDIENCE'),
  });

export interface OystehrClientOptions {
  /** Point the SDK's zambda.execute() at this URL (e.g. http://localhost:3000/local). */
  zambdaApiUrl?: string;
}

/** Construct an Oystehr SDK client from an already-minted access token (no extra token request). */
export const createOystehrFromToken = (accessToken: string, opts: OystehrClientOptions = {}): Oystehr =>
  new Oystehr({
    accessToken,
    projectId: need('PROJECT_ID'),
    services: {
      projectApiUrl: need('PROJECT_API'),
      ...(opts.zambdaApiUrl ? { zambdaApiUrl: opts.zambdaApiUrl } : {}),
    },
  });

/** Construct an Oystehr SDK client for the target project, authenticated via M2M env creds. */
export const createOystehrFromEnv = async (opts: OystehrClientOptions = {}): Promise<Oystehr> =>
  createOystehrFromToken(await mintAccessToken(), opts);

/**
 * Construct an Oystehr SDK client from an .env/<env>.json credential FILE (the
 * copy-between-projects scripts authenticate to two projects at once, so they
 * can't use process.env). `label` (e.g. 'source' / 'dest') prefixes auth errors.
 * Returns the loaded env + token too — some callers need PROJECT_ID/PROJECT_API
 * or the raw bearer token for non-SDK API calls.
 */
export const createOystehrFromEnvFile = async (
  path: string,
  label?: string
): Promise<{ oystehr: Oystehr; env: OystehrEnvConfig; accessToken: string }> => {
  const env = loadEnvFile(path);
  const accessToken = await requestAccessToken(env, label);
  const oystehr = new Oystehr({
    accessToken,
    projectId: env.PROJECT_ID,
    services: {
      projectApiUrl: env.PROJECT_API,
      ...(env.ZAMBDA_API ? { zambdaApiUrl: env.ZAMBDA_API } : {}),
    },
  });
  return { oystehr, env, accessToken };
};

/**
 * Fetch EVERY page of a FHIR search via _count/_offset pagination and return the
 * matching resources (rows of other types brought in by _include/_revinclude are
 * filtered out — don't use this helper when you need those). Replaces the
 * hand-rolled offset loops that each script grew independently.
 */
export const searchAllPages = async <T extends { resourceType: string }>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  params: Array<{ name: string; value: string }>,
  opts: { pageSize?: number; max?: number } = {}
): Promise<T[]> => {
  const pageSize = opts.pageSize ?? 500;
  const out: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = (
      await oystehr.fhir.search({
        resourceType: resourceType as 'Patient',
        params: [...params, { name: '_count', value: String(pageSize) }, { name: '_offset', value: String(offset) }],
      })
    ).unbundle() as unknown as Array<{ resourceType: string }>;
    out.push(...(page.filter((r) => r.resourceType === resourceType) as T[]));
    if (page.length < pageSize) break;
    if (opts.max !== undefined && out.length >= opts.max) break;
  }
  return opts.max !== undefined ? out.slice(0, opts.max) : out;
};
