import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InventoryRecord, InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Patient, RelatedPerson } from 'fhir/r4b';
import {
  createCandidApiClient,
  findRelatedPersonForPatient,
  getFullName,
  getResourcesFromBatchInlineRequests,
  getSecret,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'invoiceable-patients-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    const candid = createCandidApiClient(validatedParameters.secrets);

    const invoiceableClaims = await getInvoiceableClaims({ candid, limitPerPage: 100, onlyInvoiceable: true });
    if (invoiceableClaims) {
      const invoiceablePatients = await getInvoiceablePatients({
        oystehr,
        candid,
        invoiceableClaims: invoiceableClaims,
      });
      console.log('Invoiceable claims:', JSON.stringify(invoiceablePatients));
    }

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
        else return { claims: claims.concat(records), pageCount: pageCount };
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

interface InvoiceablePatient {
  name: string;
  dob: string;
  serviceDate: string; // of what?
  responsiblePartyName: string;
  responsiblePartyRelationshipToPatient: string;
  amountInvoiceable: string;
}

async function getInvoiceablePatients(input: {
  oystehr: Oystehr;
  candid: CandidApiClient;
  invoiceableClaims: InvoiceableClaim[];
}): Promise<InvoiceablePatient[] | undefined> {
  const { invoiceableClaims, oystehr, candid } = input;
  console.log('🔍 Fetching FHIR resources for invoiceable patients...');
  const uniquePatientsIds = [...new Set(invoiceableClaims.map((claim) => claim.patientExternalId))];
  const allPatientResources = await getResourcesFromBatchInlineRequests(
    oystehr,
    uniquePatientsIds.flatMap((patientId) => [
      `Patient?_id=${patientId}`,
      // `RelatedPerson?patient=Patient/${patientId}&relationship=user-relatedperson`,
    ])
  );
  console.log('FHIR resources fetched:', allPatientResources.length, 'resources');

  console.log('Creating promises for candid claims resources');
  const getAllCandidClaims = async (): Promise<Record<string, InvoiceItemizationResponse[]>> => {
    const claimsPromises = invoiceableClaims.map(async (claim) => {
      const claimPromise = await candid.patientAr.v1.itemize(CandidApi.ClaimId(claim.claimId));
      return {
        claimPromise,
        patientId: claim.patientExternalId,
      };
    });

    console.log('Waiting for all promises');
    const claimsResponse = await Promise.all(claimsPromises);

    const claimsToPatientMap: Record<string, InvoiceItemizationResponse[]> = {};
    claimsResponse.forEach((res) => {
      const { claimPromise, patientId } = res;
      if (claimPromise && claimPromise.ok && claimPromise.body) {
        const claim = claimPromise.body as InvoiceItemizationResponse;
        if (claimsToPatientMap[patientId] === undefined) claimsToPatientMap[patientId] = [claim];
        else claimsToPatientMap[patientId].push(claim);
      }
    });

    return claimsToPatientMap;
  };

  const [allPatientsResources, allClaims] = await Promise.all([allPatientResources, getAllCandidClaims()]);
  const fhirPatients = allPatientsResources.filter((patient) => patient.resourceType === 'Patient') as Patient[];
  const fhirRelatedPersons = allPatientsResources.filter(
    (patient) => patient.resourceType === 'RelatedPerson'
  ) as RelatedPerson[];
  console.log('claimsToPatientMap:', JSON.stringify(allPatientResources));
  console.log('claimsToPatientMap:', JSON.stringify(fhirPatients));
  console.log('claimsToPatientMap:', JSON.stringify(fhirRelatedPersons));

  const result: InvoiceablePatient[] = [];
  invoiceableClaims.forEach((claim) => {
    const patient = fhirPatients.find((patient) => patient.id === claim.patientExternalId);
    if (patient?.id === undefined) {
      // console.error('🔴 Patient not found for claim:', claim);
      return;
    }
    const relatedPerson = findRelatedPersonForPatient(patient, fhirRelatedPersons);
    const patientBalance = allClaims[patient.id].reduce((acc, claim) => acc + claim.patientBalanceCents, 0);

    result.push({
      name: getFullName(patient),
      dob: patient.birthDate || '',
      serviceDate: '',
      responsiblePartyName: relatedPerson?.name?.[0]?.text || '',
      responsiblePartyRelationshipToPatient: '',
      amountInvoiceable: `${patientBalance}`,
    });
  });
  return result;
}
