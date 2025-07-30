import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ServiceRequest } from 'fhir/r4b';
import { DiagnosticReport, Reference } from 'fhir/r5';
import { getSecret, RoleType, SavePreliminaryReportZambdaOutput, Secrets, SecretsKeys, User } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { ACCESSION_NUMBER_CODE_SYSTEM, ADVAPACS_FHIR_BASE_URL, fetchServiceRequestFromAdvaPACS } from '../shared';
import { ValidatedInput, validateInput, validateSecrets } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'save-preliminary-report';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    const validatedInput = await validateInput(unsafeInput);

    await accessCheck(validatedInput.callerAccessToken, secrets);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const output = await performEffect(validatedInput, secrets, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify({ output }),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
});

async function performEffect(
  validatedInput: ValidatedInput,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<SavePreliminaryReportZambdaOutput> {
  const { serviceRequestId, preliminaryReport } = validatedInput.body;

  // Get the existing service request from Oystehr
  console.group('Fetching service request from Oystehr');
  const serviceRequest: ServiceRequest = await oystehr.fhir.get({
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
  });
  console.groupEnd();
  console.debug('Service request fetched successfully');

  // Extract the accession number from the service request
  const accessionNumber = serviceRequest.identifier?.find(
    (identifier) => identifier.system === ACCESSION_NUMBER_CODE_SYSTEM
  )?.value;

  if (!accessionNumber) {
    throw new Error('No accession number found in service request, cannot save preliminary report to AdvaPACS.');
  }

  // Fetch the corresponding service request from AdvaPACS using the accession number
  console.group('Fetching service request from AdvaPACS');
  const advaPacsServiceRequest = await fetchServiceRequestFromAdvaPACS(accessionNumber, secrets);
  console.groupEnd();
  console.debug('AdvaPACS service request fetched successfully');

  // Create a DiagnosticReport in AdvaPACS with the preliminary report
  console.group('Creating DiagnosticReport in AdvaPACS');
  await createDiagnosticReportInAdvaPACS(advaPacsServiceRequest, preliminaryReport, secrets);
  console.groupEnd();
  console.debug('DiagnosticReport created successfully in AdvaPACS');

  return {};
}

const accessCheck = async (callerAccessToken: string, secrets: Secrets): Promise<void> => {
  const callerUser = await getCallerUserWithAccessToken(callerAccessToken, secrets);

  if (callerUser.profile.indexOf('Practitioner/') === -1) {
    throw new Error('Caller does not have a practitioner profile');
  }
  if (callerUser.roles?.find((role) => role.name === RoleType.Provider) === undefined) {
    throw new Error('Caller does not have provider role');
  }
};

const getCallerUserWithAccessToken = async (token: string, secrets: Secrets): Promise<User> => {
  const oystehr = createOystehrClient(token, secrets);
  return await oystehr.user.me();
};

/**
 * Creates a DiagnosticReport in AdvaPACS for a ServiceRequest with preliminary findings
 * @param advaPacsServiceRequestId The ServiceRequest ID in AdvaPACS
 * @param preliminaryReport The preliminary report text
 * @param secrets The secrets containing AdvaPACS credentials
 * @returns The created DiagnosticReport
 */
const createDiagnosticReportInAdvaPACS = async (
  advaPacsServiceRequest: ServiceRequest,
  preliminaryReport: string,
  secrets: Secrets
): Promise<any> => {
  const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
  const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
  const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;

  const reportAsBase64 = Buffer.from(preliminaryReport).toString('base64');
  const reportAsBase64Size = Buffer.byteLength(reportAsBase64);

  const diagnosticReport: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    status: 'preliminary',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: 'RAD',
            display: 'Radiology',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '18748-4',
          display: 'Diagnostic imaging study',
        },
      ],
    },
    basedOn: [
      {
        reference: `ServiceRequest/${advaPacsServiceRequest.id}`,
      },
    ],
    subject: advaPacsServiceRequest.subject as Reference,
    presentedForm: [
      {
        contentType: 'text/html',
        data: reportAsBase64,
        size: `${reportAsBase64Size}`,
      },
    ],
  };

  const response = await fetch(`${ADVAPACS_FHIR_BASE_URL}/DiagnosticReport`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/fhir+json',
      Authorization: advapacsAuthString,
    },
    body: JSON.stringify(diagnosticReport),
  });

  if (!response.ok) {
    throw new Error(
      `AdvaPACS DiagnosticReport creation errored out with statusCode ${response.status}, status text ${
        response.statusText
      }, and body ${JSON.stringify(await response.json(), null, 2)}`
    );
  }

  return await response.json();
};
