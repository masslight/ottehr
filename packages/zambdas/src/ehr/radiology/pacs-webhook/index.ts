import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  DiagnosticReport,
  DiagnosticReport as DiagnosticReportR5,
  ServiceRequest,
  ServiceRequest as ServiceRequestR5,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getSecret, Secrets, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, ZambdaInput } from '../../../shared';
import {
  ACCESSION_NUMBER_CODE_SYSTEM,
  ADVAPACS_FHIR_BASE_URL,
  ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER,
  ORDER_TYPE_CODE_SYSTEM,
} from '../shared';
import { validateInput, validateSecrets } from './validation';

// Types
export interface PacsWebhookBody {
  body: unknown;
}

export interface ValidatedInput {
  resource: ServiceRequestR5 | DiagnosticReportR5;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const validatedInput = await validateInput(unsafeInput);

    await accessCheck(unsafeInput.headers, secrets);

    await performEffect(validatedInput, oystehr, secrets);

    return {
      statusCode: 200,
      body: JSON.stringify({}),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

const accessCheck = async (headers: any, secrets: Secrets): Promise<void> => {
  if (headers == null || !headers.authorization) {
    throw new Error('Unauthorized');
  }

  if (headers.authorization.split('Bearer ')[1] !== getSecret(SecretsKeys.ADVAPACS_WEBHOOK_SECRET, secrets)) {
    throw new Error('Forbidden');
  }
};

const performEffect = async (validatedInput: ValidatedInput, oystehr: Oystehr, secrets: Secrets): Promise<void> => {
  const { resource } = validatedInput;

  if (resource.id == null) {
    throw new Error('Resource ID is required');
  }

  if (resource.resourceType === 'ServiceRequest') {
    const accessionNumber = resource.identifier?.find((i) => {
      return (
        i.type?.coding?.[0].system === HL7_IDENTIFIER_TYPE_CODE_SYSTEM &&
        i.type?.coding?.[0].code === HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER &&
        i.system === ACCESSION_NUMBER_CODE_SYSTEM
      );
    })?.value;
    if (accessionNumber == null) {
      throw new Error('Accession number is required');
    }

    const srResults = (
      await oystehr.fhir.search<ServiceRequest>({
        resourceType: 'ServiceRequest',
        params: [
          {
            name: '_tag',
            value: `${ORDER_TYPE_CODE_SYSTEM}|radiology`,
          },
          {
            name: 'identifier',
            // TODO can we include also the type.coding.system & code to be super exact here?
            // TODO maybe encode | as %7C
            value: `${ACCESSION_NUMBER_CODE_SYSTEM}|${accessionNumber}`,
          },
        ],
      })
    ).unbundle();

    if (srResults.length === 0) {
      throw new Error('No ServiceRequest found with the given accession number');
    }

    if (srResults.length > 1) {
      throw new Error('Multiple ServiceRequests found with the given accession number');
    }

    const srToUpdate = srResults[0];

    if (srToUpdate.id == null) {
      throw new Error('ServiceRequest ID is required');
    }

    const operations: Operation[] = [
      {
        op: 'replace',
        path: '/status',
        value: resource.status,
      },
    ];

    if (resource.performer) {
      // TODO make a good plan for practitioner sync
      // operations.push({
      //   op: 'add',
      //   path: '/performer',
      //   value: resource.performer,
      // });
      if (!srToUpdate.performer) {
        operations.push({
          op: 'add',
          path: '/extension',
          value: [
            {
              url: 'performedOn',
              valueDateTime: DateTime.now().toISO(),
            },
          ],
        });
      }
    }

    await oystehr.fhir.patch<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: srToUpdate.id,
      operations,
    });
  } else if (resource.resourceType === 'DiagnosticReport') {
    // We get a DR from PACS
    // Look up DR in our system, how:
    // Fetch the basedOn ServiceRequest, find SR in our system with same accession number, include DRs, now we have our DR?
    // OR when we first create DR, we put their ID in our system as an identifier. That is better let's do that.

    // First we want to figure out if we need to create or update, so we search for the DR in our FHIR store
    const drSearchResults = (
      await oystehr.fhir.search<DiagnosticReport>({
        resourceType: 'DiagnosticReport',
        params: [
          {
            name: 'identifier',
            // TODO can we include also the type.coding.system & code to be super exact here?
            // TODO maybe encode | as %7C
            value: `${ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM}|${resource.id}`,
          },
        ],
      })
    ).unbundle();

    if (drSearchResults.length > 1) {
      throw new Error('Multiple DiagnosticReports found with the given ID');
    } else if (drSearchResults.length === 1) {
      // Update case
      const drToUpdate = drSearchResults[0];

      const operations: Operation[] = [
        {
          op: 'replace',
          path: '/status',
          value: resource.status,
        },
        {
          op: 'add',
          path: '/presentedForm',
          value: resource.presentedForm,
        },
      ];

      if (drToUpdate.status !== resource.status && resource.status === 'final') {
        operations.push({
          op: 'add',
          path: '/issued',
          value: DateTime.now().toISO(),
        });
      }
    } else if (drSearchResults.length === 0) {
      // Create case
      // Now look up the SR via DR.basedOn, so we can create our own DR with our own SR basedOn
      const pacsServiceRequestID = resource.basedOn?.[0]?.reference;
      if (pacsServiceRequestID == null) {
        throw new Error('The DiagnosticReport was not associated with any ServiceRequest');
      }

      const pacsServiceRequest = await getAdvaPacsServiceRequestByID(pacsServiceRequestID, secrets);
      const pacsServiceRequestAccessionNumber = pacsServiceRequest.identifier?.find(
        (i) => i.system === ACCESSION_NUMBER_CODE_SYSTEM
      )?.value;
      if (pacsServiceRequestAccessionNumber == null) {
        throw new Error('The ServiceRequest was not associated with any accession number');
      }
      const ourServiceRequest = await getOurServiceRequestByAccessionNumber(pacsServiceRequestAccessionNumber, oystehr);
      await createOurDiagnosticReport(ourServiceRequest, resource, oystehr);
    }
  }

  throw new Error('Unexpected resource type in performEffect');
};

const getAdvaPacsServiceRequestByID = async (
  serviceRequestRelativeReference: string,
  secrets: Secrets
): Promise<ServiceRequestR5> => {
  try {
    const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
    const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
    const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;

    const advapacsResponse = await fetch(`${ADVAPACS_FHIR_BASE_URL}/${serviceRequestRelativeReference}}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/fhir+json',
        Authorization: advapacsAuthString,
      },
    });
    if (!advapacsResponse.ok) {
      throw new Error(
        `advapacs transaction errored out with statusCode ${advapacsResponse.status}, status text ${
          advapacsResponse.statusText
        }, and body ${JSON.stringify(await advapacsResponse.json(), null, 2)}`
      );
    }

    const maybeSR = await advapacsResponse.json();

    if (maybeSR.resourceType !== 'ServiceRequest') {
      throw new Error(`Expected ServiceRequest but got ${maybeSR.resourceType}`);
    }

    return maybeSR;
  } catch (error) {
    console.log('write transaction to advapacs error: ', error);
    throw error;
  }
};

const getOurServiceRequestByAccessionNumber = async (
  accessionNumber: string,
  oystehr: Oystehr
): Promise<ServiceRequest> => {
  const srResults = (
    await oystehr.fhir.search<ServiceRequest>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: '_tag',
          value: `${ORDER_TYPE_CODE_SYSTEM}|radiology`,
        },
        {
          name: 'identifier',
          // TODO can we include also the type.coding.system & code to be super exact here?
          // TODO maybe encode | as %7C
          value: `${ACCESSION_NUMBER_CODE_SYSTEM}|${accessionNumber}`,
        },
      ],
    })
  ).unbundle();

  if (srResults.length === 0) {
    throw new Error('No ServiceRequest found with the given accession number');
  }

  if (srResults.length > 1) {
    throw new Error('Multiple ServiceRequests found with the given accession number');
  }

  return srResults[0];
};

const createOurDiagnosticReport = async (
  serviceRequest: ServiceRequest,
  pacsDiagnosticReport: DiagnosticReportR5,
  oystehr: Oystehr
): Promise<void> => {
  const diagnosticReportToCreate: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    status: pacsDiagnosticReport.status,
    subject: serviceRequest.subject,
    basedOn: [
      {
        reference: serviceRequest.id,
      },
    ],
    identifier: [
      {
        system: ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM,
        value: pacsDiagnosticReport.id,
      },
    ],
    code: pacsDiagnosticReport.code,
    presentedForm: pacsDiagnosticReport.presentedForm,
  };

  await oystehr.fhir.create<DiagnosticReport>(diagnosticReportToCreate);
};
