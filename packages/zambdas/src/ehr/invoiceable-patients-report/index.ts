import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InventoryRecord } from 'candidhealth/api/resources/patientAr/resources/v1';
import { createCandidApiClient, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'invoiceable-patients-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    // const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    const candid = createCandidApiClient(validatedParameters.secrets);

    const invoiceableClaims = await getInvoiceableClaims({ candid, onlyInvoiceable: true });
    console.log('Invoiceable claims:', invoiceableClaims);

    const response = 'Invoicible patients report';
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
    console.log('Error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
});

interface InvoiceableClaim {
  claimId: string;
  encounterId: string;
  patientExternalId: string;
  patientArStatus: string;
  timestamp: string;
}

interface InvoiceableClaimsInput {
  candid: CandidApiClient;
  limitPerPage?: number;
  onlyInvoiceable?: boolean;
}

async function getInvoiceableClaims(input: InvoiceableClaimsInput): Promise<InvoiceableClaim[] | undefined> {
  try {
    const { candid, limitPerPage, onlyInvoiceable } = input;
    if (limitPerPage && limitPerPage > 100)
      throw new Error('Limit per page cannot be greater than 100 according to Candid API');

    console.log('🔍 Fetching patient inventory from Candid...');
    const getCandidPage = async (
      pageToken: string | undefined,
      claims: InventoryRecord[],
      pageCount: number
    ): Promise<{ claims: InventoryRecord[]; pageCount: number } | undefined> => {
      console.log(`📄 Fetching page ${pageCount}${pageToken ? ` (token: ${pageToken.substring(0, 20)}...)` : ''}...`);

      const inventoryResponse = await candid.patientAr.v1.listInventory({
        limit: limitPerPage,
        pageToken: pageToken ? CandidApi.PageToken(pageToken) : undefined,
      });

      if (inventoryResponse && inventoryResponse.ok && inventoryResponse.body) {
        let records = inventoryResponse.body.records as InventoryRecord[];
        const nextPageToken = inventoryResponse.body.nextPageToken;

        if (onlyInvoiceable) records = records.filter((record) => record.patientArStatus === 'invoiceable');

        console.log(`📄 Page ${pageCount}: Found ${records.length} total claims`);

        if (nextPageToken) return await getCandidPage(nextPageToken, claims.concat(records), pageCount + 1);
      } else {
        console.log('⚠️ Unexpected response format or failed request on page', pageCount);
        console.log('Response details:', JSON.stringify(inventoryResponse));
      }
      return {
        claims,
        pageCount,
      };
    };

    const inventoryPages = await getCandidPage(undefined, [], 1);

    console.log('\n📊 Patient Inventory Response:');
    console.log('===============================');
    console.log(`📄 Total pages fetched: ${inventoryPages?.pageCount}`);
    console.log(`📄 Total claims found: ${inventoryPages?.claims.length}`);
    console.log('===============================');

    const claimsFetched = inventoryPages?.claims;
    if (claimsFetched?.length && claimsFetched.length > 0) {
      return claimsFetched.map((record) => ({
        claimId: record.claimId,
        encounterId: record.encounterId,
        patientExternalId: record.patientExternalId,
        patientArStatus: record.patientArStatus,
        timestamp: record.timestamp.toISOString(),
      }));
    } else {
      console.log('📄 No invoiceable patients found');
      return undefined;
    }
  } catch (error) {
    console.error('❌ Error fetching invoiceable patients:', error);
    if (error instanceof Error) console.error('Error message:', error.message);
    throw error;
  }
}

// interface InvoiceablePatient {
//   name: string;
//   dob: string;
//   serviceDate: string; // of what?
//   responsiblePartyName: string;
//   responsiblePartyRelationshipToPatient: string;
//   amountInvoiceable: string;
//   invoiceableClaims: any[];
// }

// async function getInvoiceablePatients(input: {
//   invoiceableClaims: InvoiceableClaim[];
// }): Promise<InvoiceablePatient[] | undefined> {
//   const { invoiceableClaims } = input;
//   const uniquePatientsIds = new Set(invoiceableClaims.map((claim) => claim.patientExternalId));
// }
