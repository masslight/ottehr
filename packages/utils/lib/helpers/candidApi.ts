import Oystehr from '@oystehr/sdk';
import { CandidApi, CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import { InventoryRecord } from 'candidhealth/api/resources/patientAr/resources/v1';
import { DateTime } from 'luxon';
import { getOptionalSecret, getSecret, MISSING_REQUEST_SECRETS, Secrets, SecretsKeys } from 'utils';

export async function findClaimsBy(input: {
  candid: CandidApiClient;
  candidEncountersIds: string[];
  since?: DateTime;
  pageLimit?: number;
}): Promise<InventoryRecord[]> {
  const { candid, candidEncountersIds, since } = input;
  const limitPerPage = 100; // according to Candid API it's maximum amount per page
  const pageLimit = input.pageLimit ?? 100;

  let pageToken: string | undefined = undefined;
  let pageCount = 0;
  const resultClaims: InventoryRecord[] = [];
  const leftToFindIds = new Set<string>(candidEncountersIds);

  do {
    console.log(`📄 Fetching page ${pageCount}`);

    const inventoryResponse = await candid.patientAr.v1.listInventory({
      limit: limitPerPage,
      since: since?.toJSDate(),
      pageToken: pageToken ? CandidApi.PageToken(pageToken) : undefined,
    });

    if (inventoryResponse && inventoryResponse.ok && inventoryResponse.body) {
      const records = inventoryResponse.body.records as InventoryRecord[];
      pageToken = inventoryResponse.body.nextPageToken;

      records.forEach((record) => {
        if (record.encounterId && leftToFindIds.has(record.encounterId.toString())) {
          resultClaims.push(record);
          leftToFindIds.delete(record.encounterId.toString());
        }
      });

      console.log(`📄 Page ${pageCount}: Found ${records.length} total claims`);
      pageCount++;
    } else {
      console.log('⚠️ Unexpected response format or failed request on page', pageCount);
      console.log('Response details:', JSON.stringify(inventoryResponse));
      throw new Error(`'⚠️ Unexpected response format or failed request on page', ${pageCount}`);
    }
  } while (pageToken && pageCount < pageLimit && leftToFindIds.size !== 0);

  return resultClaims;
}

export async function getCandidInventoryPages(input: {
  candid: CandidApiClient;
  onlyInvoiceable?: boolean;
  limitPerPage?: number;
  maxPages?: number;
  since?: DateTime;
}): Promise<{ claims: InventoryRecord[]; pageCount: number } | undefined> {
  const { candid, onlyInvoiceable, limitPerPage, maxPages, since } = input;

  return await getCandidInventoryPageRecursive({
    candid,
    claims: [],
    pageCount: 0,
    onlyInvoiceable,
    limitPerPage,
    maxPages,
    since,
  });
}

async function getCandidInventoryPageRecursive(input: {
  candid: CandidApiClient;
  pageToken?: string;
  claims: InventoryRecord[];
  pageCount: number;
  onlyInvoiceable?: boolean;
  limitPerPage?: number;
  maxPages?: number;
  since?: DateTime;
}): Promise<{ claims: InventoryRecord[]; pageCount: number } | undefined> {
  const { candid, pageToken, limitPerPage, claims, pageCount, onlyInvoiceable, maxPages, since } = input;

  if (maxPages && pageCount >= maxPages) return { claims, pageCount };

  console.log(`📄 Fetching page ${pageCount}`);
  const inventoryResponse = await candid.patientAr.v1.listInventory(
    {
      limit: limitPerPage,
      since: since?.toJSDate(),
      pageToken: pageToken ? CandidApi.PageToken(pageToken) : undefined,
    },
    {
      maxRetries: 5,
    }
  );

  if (inventoryResponse && inventoryResponse.ok && inventoryResponse.body) {
    const allRecords = inventoryResponse.body.records as InventoryRecord[];
    const nextPageToken = inventoryResponse.body.nextPageToken;

    let records = allRecords;
    if (onlyInvoiceable) records = allRecords.filter((record) => record.patientArStatus === 'invoiceable');

    console.log(`📄 Page ${pageCount}: Found ${allRecords.length} total claims, ${records.length} invoiceable`);

    if (nextPageToken)
      return await getCandidInventoryPageRecursive({
        ...input,
        claims: claims.concat(records),
        pageToken: nextPageToken,
        pageCount: pageCount + 1,
      });
    else return { claims: claims.concat(records), pageCount: pageCount };
  } else {
    console.log('⚠️ Unexpected response format or failed request on page', pageCount);
    console.log('Response details:', JSON.stringify(inventoryResponse));
  }
  return {
    claims,
    pageCount,
  };
}

// candid api client token caching across warm lambdas

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

/** @internal — test-only; not re-exported from the package barrel. */
export function __resetCandidApiClientForTests(): void {
  inflightRefresh = undefined;
  cachedCandidApiClient = undefined;
  cachedToken = undefined;
  latestOystehr = undefined;
  latestSecrets = null;
}

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

  cachedCandidApiClient = new CandidApiClient({
    token: async () => {
      if (!latestOystehr) throw new Error('candid client invoked before getOrCreateCandidApiClient populated oystehr');
      return (await getOrCreateToken(latestOystehr, latestSecrets)).accessToken;
    },
    environment: candidEnv === 'PROD' ? CandidApiEnvironment.Production : CandidApiEnvironment.Staging,
  });
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
