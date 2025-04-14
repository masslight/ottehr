import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport as DiagnosticReportR5, ServiceRequest, ServiceRequest as ServiceRequestR5 } from 'fhir/r4b';
import { getSecret, Secrets, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, ZambdaInput } from '../../../shared';
import {
  ACCESSION_NUMBER_CODE_SYSTEM,
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

    await performEffect(validatedInput, oystehr);

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

const performEffect = async (validatedInput: ValidatedInput, oystehr: Oystehr): Promise<void> => {
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

    await oystehr.fhir.patch<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: srToUpdate.id,
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: resource.status,
        },
        // TODO patch other stuff besides status
      ],
    });
  } else if (resource.resourceType === 'DiagnosticReport') {
    // TODO Patch DR in our FHIR store with updated information using identifier
    // create if not exists
    // if exists update with status and other details
  }

  throw new Error('Unexpected resource type in performEffect');
};
