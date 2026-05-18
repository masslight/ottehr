import Oystehr from '@oystehr/sdk';
import { CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import { getOptionalSecret, getSecret, MISSING_REQUEST_SECRETS, Secrets, SecretsKeys } from 'utils';

const CANDID_OAUTH_TOKEN_CACHE_SECRET = 'CANDID_OAUTH_TOKEN_CACHE';

interface CandidToken {
  accessToken: string;
  expiresAt: Date;
}

// Lifting these to module scope keeps them in memory across warm lambda invocations.
let inflightRefresh: Promise<CandidToken> | undefined;
let cachedCandidApiClient: CandidApiClient | undefined;
let cachedToken: CandidToken | undefined;
let latestOystehr: Oystehr | undefined;
let latestSecrets: Secrets | null = null;

export async function getOrCreateCandidApiClient(oystehr: Oystehr, secrets: Secrets | null): Promise<CandidApiClient> {
  latestOystehr = oystehr;
  latestSecrets = secrets;

  if (cachedCandidApiClient) return cachedCandidApiClient;

  const candidClientId = getOptionalSecret(SecretsKeys.CANDID_CLIENT_ID, secrets);
  const candidClientSecret = getOptionalSecret(SecretsKeys.CANDID_CLIENT_SECRET, secrets);
  const candidEnv = getOptionalSecret(SecretsKeys.CANDID_ENV, secrets);
  if (!candidClientId || !candidClientSecret || !candidEnv) {
    throw MISSING_REQUEST_SECRETS;
  }

  const client = createCandidApiClient(secrets);
  // The Candid SDK constructs a private _oauthTokenProvider that calls /auth/v2/token on demand.
  // Replace its getToken so every authenticated request fetches the secret first
  const internals = client as unknown as { _oauthTokenProvider?: { getToken?: unknown } };
  // Assert the shape up front — if a candidhealth SDK upgrade renames this field, fail loudly here
  // rather than silently letting the SDK fetch its own tokens and reintroducing the 429s.
  if (typeof internals._oauthTokenProvider?.getToken !== 'function') {
    throw new Error('candidhealth SDK shape changed: expected client._oauthTokenProvider.getToken to be a function');
  }
  (internals._oauthTokenProvider as { getToken: () => Promise<string> }).getToken = async () => {
    if (!latestOystehr) throw new Error('candid client invoked before getOrCreateCandidApiClient populated oystehr');
    return (await getOrCreateToken(latestOystehr, latestSecrets)).accessToken;
  };

  cachedCandidApiClient = client;
  return cachedCandidApiClient;
}

async function getOrCreateToken(oystehr: Oystehr, secrets: Secrets | null): Promise<CandidToken> {
  if (cachedToken && isStillFresh(cachedToken)) return cachedToken;
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    const stored = await readTokenFromOystehrSecret(oystehr);
    if (stored && isStillFresh(stored)) {
      cachedToken = stored;
      return stored;
    }

    const fresh = await fetchTokenFromCandid(secrets);
    await writeTokenToOystehrSecret(oystehr, fresh);
    cachedToken = fresh;
    return fresh;
  })().finally(() => {
    inflightRefresh = undefined;
  });
  return inflightRefresh;
}

function isStillFresh(token: CandidToken): boolean {
  // 5 minute buffer
  return token.expiresAt.getTime() - 5 * 60 * 1000 > Date.now();
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

// not exporting so other zambdas must use getOrCreateCandidApiClient to share the cached token
function createCandidApiClient(secrets: Secrets | null): CandidApiClient {
  return new CandidApiClient({
    clientId: getSecret(SecretsKeys.CANDID_CLIENT_ID, secrets),
    clientSecret: getSecret(SecretsKeys.CANDID_CLIENT_SECRET, secrets),
    environment:
      getSecret(SecretsKeys.CANDID_ENV, secrets) === 'PROD'
        ? CandidApiEnvironment.Production
        : CandidApiEnvironment.Staging,
  });
}
