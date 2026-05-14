import Oystehr from '@oystehr/sdk';
import { CandidApiClient } from 'candidhealth';
import { CandidToken, createCandidApiClient, getOptionalSecret, getSecret, Secrets, SecretsKeys } from 'utils';

export const FIVE_MINUTES = 5 * 60 * 1000;
const CANDID_OAUTH_TOKEN_CACHE_SECRET = 'CANDID_OAUTH_TOKEN_CACHE';

// Lifting these to module scope keeps them in memory across warm lambda invocations.
let inflightRefresh: Promise<CandidToken> | undefined;
let cachedCandidApiClient: CandidApiClient | undefined;

export async function getOrCreateCandidApiClientIfConfigured(
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<CandidApiClient | null> {
  const candidClientId = getOptionalSecret(SecretsKeys.CANDID_CLIENT_ID, secrets);
  if (!candidClientId) return null;

  return getOrCreateCandidApiClient(oystehr, secrets);
}

export async function getOrCreateCandidApiClient(oystehr: Oystehr, secrets: Secrets | null): Promise<CandidApiClient> {
  if (cachedCandidApiClient) return cachedCandidApiClient;

  const client = createCandidApiClient(secrets);
  // The Candid SDK constructs a private _oauthTokenProvider that calls /auth/v2/token on demand.
  // Replace its getToken so every authenticated request fetches the secret first
  (client as unknown as { _oauthTokenProvider: { getToken: () => Promise<string> } })._oauthTokenProvider.getToken =
    async () => (await getOrCreateToken(oystehr, secrets)).accessToken;

  cachedCandidApiClient = client;
  return cachedCandidApiClient;
}

async function getOrCreateToken(oystehr: Oystehr, secrets: Secrets | null): Promise<CandidToken> {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    const stored = await readTokenFromOystehrSecret(oystehr);
    if (stored && isStillFresh(stored)) {
      return stored;
    }

    const fresh = await fetchTokenFromCandid(secrets);
    await writeTokenToOystehrSecret(oystehr, fresh);
    return fresh;
  })().finally(() => {
    inflightRefresh = undefined;
  });
  return inflightRefresh;
}

function isStillFresh(token: CandidToken): boolean {
  return token.expiresAt.getTime() - FIVE_MINUTES > Date.now();
}

async function readTokenFromOystehrSecret(oystehr: Oystehr): Promise<CandidToken | undefined> {
  try {
    const response = await oystehr.secret.get({ name: CANDID_OAUTH_TOKEN_CACHE_SECRET });
    if (!response?.value) return undefined;
    const parsed = JSON.parse(response.value) as { accessToken: string; expiresAt: string };
    return {
      accessToken: parsed.accessToken,
      expiresAt: new Date(parsed.expiresAt),
    };
  } catch (err) {
    console.log(`${CANDID_OAUTH_TOKEN_CACHE_SECRET} secret unavailable, refreshing from Candid:`, err);
    return undefined;
  }
}

async function writeTokenToOystehrSecret(oystehr: Oystehr, token: CandidToken): Promise<void> {
  try {
    await oystehr.secret.set({
      name: CANDID_OAUTH_TOKEN_CACHE_SECRET,
      value: JSON.stringify({
        accessToken: token.accessToken,
        expiresAt: token.expiresAt.toISOString(),
      }),
    });
  } catch (err) {
    console.error(`failed to persist ${CANDID_OAUTH_TOKEN_CACHE_SECRET} secret:`, err);
  }
}

async function fetchTokenFromCandid(secrets: Secrets | null): Promise<CandidToken> {
  const apiClient = createCandidApiClient(secrets);
  const response = await apiClient.auth.default.getToken({
    clientId: getSecret(SecretsKeys.CANDID_CLIENT_ID, secrets),
    clientSecret: getSecret(SecretsKeys.CANDID_CLIENT_SECRET, secrets),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Candid OAuth token: ${JSON.stringify(response.error)}`);
  }
  return {
    accessToken: response.body.accessToken,
    expiresAt: new Date(Date.now() + response.body.expiresIn * 1000),
  };
}
