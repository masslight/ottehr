import { CandidApi, CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import { InventoryRecord } from 'candidhealth/api/resources/patientAr/resources/v1';
import { APIResponse } from 'candidhealth/core';
import { DateTime } from 'luxon';
import { getSecret, Secrets, SecretsKeys } from '../secrets';

export const CANDID_BATCH_SIZE = 3;

export async function retryWithBackoff<T, E>(
  fn: () => Promise<APIResponse<T, E>>,
  maxRetries = 4,
  baseDelayMs = 200
): Promise<APIResponse<T, E>> {
  let lastResponse: APIResponse<T, E> | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let retryAfterMs: number | undefined;
    try {
      const response = await fn();
      if (response.ok || (response.error && response.rawResponse.status !== 429) || attempt === maxRetries)
        return response;
      lastResponse = response;
      retryAfterMs = parseRetryAfterHeader(response.rawResponse.headers);
    } catch (error: any) {
      if (attempt === maxRetries) throw error;
      const isTooManyRequests =
        error?.body?.errorName === 'TooManyRequestsError' ||
        error?.message?.includes('Too many requests') ||
        error?.statusCode === 429;
      if (!isTooManyRequests) throw error;
    }
    const delay = retryAfterMs ?? baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
    console.warn(
      `Candid API request rate limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return lastResponse ?? fn();
}

function parseRetryAfterHeader(headers: Headers | Record<string, any> | undefined): number | undefined {
  if (!headers) return undefined;
  let raw: string | null | undefined;
  if (typeof (headers as Headers).get === 'function') {
    raw = (headers as Headers).get('retry-after');
  } else {
    const entry = Object.entries(headers as Record<string, any>).find(([key]) => key.toLowerCase() === 'retry-after');
    raw = entry?.[1];
  }
  if (raw == null) return undefined;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds * 1000;
}

export function createCandidApiClient(secrets: Secrets | null): CandidApiClient {
  const candidApiClient: CandidApiClient = new CandidApiClient({
    clientId: getSecret(SecretsKeys.CANDID_CLIENT_ID, secrets),
    clientSecret: getSecret(SecretsKeys.CANDID_CLIENT_SECRET, secrets),
    environment:
      getSecret(SecretsKeys.CANDID_ENV, secrets) === 'PROD'
        ? CandidApiEnvironment.Production
        : CandidApiEnvironment.Staging,
  });
  return candidApiClient;
}

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

    const inventoryResponse = await retryWithBackoff(() =>
      candid.patientAr.v1.listInventory({
        limit: limitPerPage,
        since: since?.toJSDate(),
        pageToken: pageToken ? CandidApi.PageToken(pageToken) : undefined,
      })
    );

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
  const inventoryResponse = await candid.patientAr.v1.listInventory({
    limit: limitPerPage,
    since: since?.toJSDate(),
    pageToken: pageToken ? CandidApi.PageToken(pageToken) : undefined,
  });

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
