import { CandidApi, CandidApiClient } from 'candidhealth';
import { InventoryRecord } from 'candidhealth/api/resources/patientAr/resources/v1';
import { DateTime } from 'luxon';

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
