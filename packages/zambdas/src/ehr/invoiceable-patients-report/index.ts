import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApiClient } from 'candidhealth';
import { Account, Appointment, Encounter, Patient, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createCandidApiClient,
  getCandidInventoryPagesRecursive,
  getPatientReferenceFromAccount,
  getResourcesFromBatchInlineRequests,
  getSecret,
  InvoiceablePatientReport,
  InvoiceablePatientReportFail,
  InvoiceablePatientsReport,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME,
  INVOICEABLE_PATIENTS_REPORTS_FILE_NAME,
} from 'utils/lib/types/api/invoiceable-patients-reports.types';
import {
  CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getCandidEncounterIdFromEncounter,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getCandidItemizationMap, InvoiceableClaim, mapResourcesToInvoiceablePatient } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'invoiceable-patients-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    const { secrets } = validatedParameters;

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const candid = createCandidApiClient(secrets);

    const invoiceableClaims = await getInvoiceableClaims({ candid, limitPerPage: 100, onlyInvoiceable: true });
    if (invoiceableClaims) {
      const invoiceablePatientsReport = await getInvoiceablePatientsReport({
        oystehr,
        candid,
        invoiceableClaims: invoiceableClaims,
      });
      if (invoiceablePatientsReport) {
        await saveReportToZ3(oystehr, invoiceablePatientsReport, secrets);
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
    const inventoryPages = await getCandidInventoryPagesRecursive({
      candid,
      claims: [],
      limitPerPage,
      pageCount: 0,
      onlyInvoiceable,
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
    const allFhirResources = async (): Promise<Resource[]> => {
      const promises: Promise<Resource[]>[] = [];
      promises.push(
        getResourcesFromBatchInlineRequests(
          oystehr,
          invoiceableClaims.map((claim) => `Patient?_id=${claim.patientExternalId}&_revinclude=Account:patient`)
        )
      );
      promises.push(
        getResourcesFromBatchInlineRequests(
          oystehr,
          invoiceableClaims.map(
            (claim) =>
              `Encounter?identifier=${CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM}|${claim.encounterId}&_include=Encounter:appointment`
          )
        )
      );
      const response = await Promise.all(promises);
      return response.flat();
    };
    console.log('Creating promises for candid claims resources');

    console.log('Waiting for all promises');
    const [allFhirResourcesResponse, itemizationMap] = await Promise.all([
      allFhirResources(),
      getCandidItemizationMap(candid, invoiceableClaims),
    ]);
    console.log('Data received');

    const patientToIdMap: Record<string, Patient> = {};
    const appointmentToIdMap: Record<string, Appointment> = {};
    const accountsToPatientIdMap: Record<string, Account> = {};
    const encounterToCandidIdMap: Record<string, Encounter> = {};
    allFhirResourcesResponse.forEach((resource) => {
      if (!resource.id) return;
      if (resource.resourceType === 'Patient') {
        patientToIdMap[resource.id] = resource as Patient;
      }
      if (resource.resourceType === 'Account') {
        const patientId = getPatientReferenceFromAccount(resource as Account)?.split('/')[1];
        if (patientId) {
          accountsToPatientIdMap[patientId] = resource as Account;
        }
      }
      if (resource.resourceType === 'Appointment') {
        appointmentToIdMap[resource.id] = resource as Appointment;
      }
      if (resource.resourceType === 'Encounter') {
        const candidEncounterId = getCandidEncounterIdFromEncounter(resource as Encounter);
        if (candidEncounterId) encounterToCandidIdMap[candidEncounterId] = resource as Encounter;
      }
    });

    const resultReports: InvoiceablePatientReport[] = [];
    const resultReportsErrors: InvoiceablePatientReportFail[] = [];
    invoiceableClaims.forEach((claim) => {
      const report = mapResourcesToInvoiceablePatient({
        patientToIdMap,
        encounterToCandidIdMap,
        accountsToPatientIdMap,
        appointmentToIdMap,
        itemizationMap,
        claim,
        allFhirResources: allFhirResourcesResponse,
      });
      if (report && 'error' in report) resultReportsErrors.push(report);
      else if (report) resultReports.push(report);
    });
    return {
      date: DateTime.now().toFormat('MM-dd-yyyy HH:mm:ss') ?? '--',
      claimsFound: invoiceableClaims.length,
      patientsReports: resultReports,
      failedReports: resultReportsErrors,
    };
  } catch (error) {
    console.error('Error fetching invoiceable patients: ', error);
    throw new Error('Failed to fetch invoiceable patients: ' + error);
  }
}

async function saveReportToZ3(oystehr: Oystehr, data: InvoiceablePatientsReport, secrets: Secrets): Promise<void> {
  try {
    const fullBucketName = `${getSecret(SecretsKeys.PROJECT_ID, secrets)}-${INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME}`;

    console.log('Uploading report to Z3 bucket: ', fullBucketName);

    await oystehr.z3.uploadFile({
      bucketName: fullBucketName,
      'objectPath+': INVOICEABLE_PATIENTS_REPORTS_FILE_NAME,
      file: new Blob([JSON.stringify(data)], { type: 'application/json' }),
    });

    console.log('Report uploaded to Z3');
  } catch (error) {
    console.error('Unable to save report to Z3: ', error);
    throw new Error('Unable to save report to Z3: ' + error);
  }
}
