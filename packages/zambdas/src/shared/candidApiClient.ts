import Oystehr from '@oystehr/sdk';
import { CandidApiClient } from 'candidhealth';
import {
  CandidToken,
  chooseJson,
  createCandidApiClient,
  getOptionalSecret,
  GetOrCreateCandidApiClientZambdaOutput,
  Secrets,
  SecretsKeys,
} from 'utils';

export const FIVE_MINUTES = 5 * 60 * 1000;
const GET_OR_CREATE_CANDID_API_CLIENT_ZAMBDA_ID = 'get-or-create-candid-api-client';

// Lifting these to module scope keeps them in memory across warm lambda invocations.
let cachedToken: CandidToken | undefined;
let inflightTokenFetch: Promise<CandidToken> | undefined;
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
  // Replace its getToken so every authenticated request in this lambda routes through the
  // central get-or-create-candid-api-client zambda's cache instead of hitting Candid auth
  // directly. SDK internal refresh() is never invoked.
  (client as unknown as { _oauthTokenProvider: { getToken: () => Promise<string> } })._oauthTokenProvider.getToken =
    () => getToken(oystehr);

  cachedCandidApiClient = client;
  return cachedCandidApiClient;
}

async function getToken(oystehr: Oystehr): Promise<string> {
  if (!cachedToken || cachedToken.expiresAt.getTime() - FIVE_MINUTES <= Date.now()) {
    cachedToken = await fetchTokenFromCentralZambda(oystehr);
  }
  return cachedToken.accessToken;
}

async function fetchTokenFromCentralZambda(oystehr: Oystehr): Promise<CandidToken> {
  if (inflightTokenFetch) return inflightTokenFetch;

  inflightTokenFetch = (async () => {
    const response = await oystehr.zambda.execute({ id: GET_OR_CREATE_CANDID_API_CLIENT_ZAMBDA_ID });
    const body = chooseJson(response) as GetOrCreateCandidApiClientZambdaOutput;
    return {
      accessToken: body.accessToken,
      expiresAt: new Date(body.expiresAt),
    };
  })().finally(() => {
    inflightTokenFetch = undefined;
  });
  return inflightTokenFetch;
}
