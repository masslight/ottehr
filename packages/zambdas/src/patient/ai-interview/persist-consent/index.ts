import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Consent } from 'fhir/r4b';
import {
  createOystehrClient,
  FHIR_AI_CHAT_CONSENT_CATEGORY_CODE,
  getSecret,
  PersistConsentInput,
  PROJECT_WEBSITE,
  Secrets,
  SecretsKeys,
} from 'utils';
import { getAuth0Token, validateJsonBody, validateString, ZambdaInput } from '../../../shared';

let oystehrToken: string;

interface Input extends PersistConsentInput {
  secrets: Secrets | null;
}

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { appointmentId, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    const consent = await oystehr.fhir.create<Consent>({
      resourceType: 'Consent',
      status: 'active',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
              code: FHIR_AI_CHAT_CONSENT_CATEGORY_CODE,
            },
          ],
        },
      ],
      policy: [
        {
          uri: PROJECT_WEBSITE,
        },
      ],
      scope: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'patient-privacy',
          },
        ],
      },
      provision: {
        data: [
          {
            meaning: 'related',
            reference: {
              reference: 'Appointment/' + appointmentId,
            },
          },
        ],
      },
    });
    return {
      statusCode: 200,
      body: JSON.stringify(consent),
    };
  } catch (error: any) {
    console.log('error', error, error.issue);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

function validateInput(input: ZambdaInput): Input {
  const { appointmentId } = validateJsonBody(input);
  return {
    appointmentId: validateString(appointmentId, 'appointmentId'),
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(
    oystehrToken,
    getSecret(SecretsKeys.FHIR_API, secrets),
    getSecret(SecretsKeys.PROJECT_API, secrets)
  );
}
