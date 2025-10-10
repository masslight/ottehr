import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApiClient } from 'candidhealth';
import { Account, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createCandidApiClient,
  getResourcesFromBatchInlineRequests,
  getSecret,
  InvoiceablePatient,
  InvoiceablePatientsReport,
  SecretsKeys,
} from 'utils';
import {
  INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME,
  INVOICEABLE_PATIENTS_REPORTS_FILE_NAME,
} from 'utils/lib/types/api/invoiceable-patients-reports.types';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import {
  getAllCandidClaims,
  getCandidPagesRecursive,
  InvoiceableClaim,
  mapResourcesToInvoiceablePatient,
} from './helpers';
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

    const invoiceableClaims = await getInvoiceableClaims({ candid, limitPerPage: 100, onlyInvoiceable: false });
    if (invoiceableClaims) {
      const invoiceablePatientsReport = await getInvoiceablePatientsReport({
        oystehr,
        candid,
        invoiceableClaims: invoiceableClaims,
      });
      if (invoiceablePatientsReport) {
        await saveReportToZ3(oystehr, invoiceablePatientsReport);
        return {
          statusCode: 200,
          body: JSON.stringify('Invoiceable patients report created and saved successfully'),
        };
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify('Error'),
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

interface InvoiceableClaimsInput {
  candid: CandidApiClient;
  limitPerPage?: number;
  onlyInvoiceable?: boolean;
}

async function getInvoiceableClaims(input: InvoiceableClaimsInput): Promise<InvoiceableClaim[] | undefined> {
  try {
    const { candid, limitPerPage, onlyInvoiceable } = input;

    console.log('🔍 Fetching patient inventory from Candid...');
    const inventoryPages = await getCandidPagesRecursive({
      candid,
      claims: [],
      limitPerPage,
      pageCount: 0,
      onlyInvoiceable,
      maxPages: 3,
    });

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
    console.error('Error fetching invoiceable claims: ', error);
    throw new Error('Failed to fetch invoiceable claims: ' + error);
  }
}

async function getInvoiceablePatientsReport(input: {
  oystehr: Oystehr;
  candid: CandidApiClient;
  invoiceableClaims: InvoiceableClaim[];
}): Promise<InvoiceablePatientsReport | undefined> {
  try {
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
    console.log('Creating promises for candid claims resources');

    console.log('Waiting for all promises');
    const [allPatientsResources, claimsToPatientsMap] = await Promise.all([
      allPatientResources,
      getAllCandidClaims(candid, invoiceableClaims),
    ]);
    console.log('Data received');

    const fhirPatients = allPatientsResources.filter((patient) => patient.resourceType === 'Patient') as Patient[];
    const fhirAccounts = allPatientsResources.filter((patient) => patient.resourceType === 'Account') as Account[];

    const result: InvoiceablePatient[] = [];
    invoiceableClaims.forEach((claim) => {
      const invoiceablePatient = mapResourcesToInvoiceablePatient(
        fhirPatients,
        fhirAccounts,
        claimsToPatientsMap,
        claim
      );
      if (invoiceablePatient) result.push(invoiceablePatient);
    });
    return {
      date: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss') ?? '--',
      claimsFound: invoiceableClaims.length.toString() ?? '--',
      patients: result,
    };
  } catch (error) {
    console.error('Error fetching invoiceable patients: ', error);
    throw new Error('Failed to fetch invoiceable patients: ' + error);
  }
}

async function saveReportToZ3(oystehr: Oystehr, data: InvoiceablePatientsReport): Promise<void> {
  try {
    console.log('Uploading report to Z3');

    const buckets = (await oystehr.z3.listBuckets()).map((bucket) => bucket.name);
    if (!buckets.includes(INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME)) {
      console.log(`Bucket ${INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME} does not exist, creating it...`);
      const createdBucket = await oystehr.z3.createBucket({ bucketName: INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME });
      console.log(`Created bucket id: ${createdBucket.id} and name: ${createdBucket.name}`);
    } else console.log('Patients reports bucket already exists');

    await oystehr.z3.uploadFile({
      bucketName: INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME,
      'objectPath+': INVOICEABLE_PATIENTS_REPORTS_FILE_NAME,
      file: new Blob([JSON.stringify(data)], { type: 'application/json' }),
    });

    console.log('Report uploaded to Z3');
  } catch (error) {
    console.error('Unable to save report to Z3: ', error);
    throw new Error('Unable to save report to Z3: ' + error);
  }
}
