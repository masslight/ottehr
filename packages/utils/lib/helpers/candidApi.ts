import { CandidApi, CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import { InventoryRecord } from 'candidhealth/api/resources/patientAr/resources/v1';
import { DateTime } from 'luxon';
import { getSecret, Secrets, SecretsKeys } from '../secrets';

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

interface getCandidPagesRecursiveParams {
  candid: CandidApiClient;
  pageToken?: string;
  claims: InventoryRecord[];
  pageCount: number;
  onlyInvoiceable?: boolean;
  limitPerPage?: number;
  maxPages?: number;
  since?: DateTime;
}

export async function getCandidInventoryPagesRecursive(
  input: getCandidPagesRecursiveParams
): Promise<{ claims: InventoryRecord[]; pageCount: number } | undefined> {
  const { candid, pageToken, limitPerPage, claims, pageCount, onlyInvoiceable, maxPages, since } = input;
  if (limitPerPage && limitPerPage > 100)
    throw new Error('Limit per page cannot be greater than 100 according to Candid API');

  if (maxPages && pageCount >= maxPages) return { claims, pageCount };

  console.log(`📄 Fetching page ${pageCount}`);
  const inventoryResponse = await candid.patientAr.v1.listInventory({
    limit: limitPerPage,
    since: since?.toJSDate(),
    pageToken: pageToken ? CandidApi.PageToken(pageToken) : undefined,
  });

  if (inventoryResponse && inventoryResponse.ok && inventoryResponse.body) {
    let records = inventoryResponse.body.records as InventoryRecord[];
    const nextPageToken = inventoryResponse.body.nextPageToken;

    if (onlyInvoiceable) records = records.filter((record) => record.patientArStatus === 'invoiceable');

    console.log(`📄 Page ${pageCount}: Found ${records.length} total claims`);

    if (nextPageToken)
      return await getCandidInventoryPagesRecursive({
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
