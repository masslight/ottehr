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
import { topLevelCatch, validateJsonBody, validateString, wrapHandler, ZambdaInput } from '../../../shared';

const ZAMBDA_NAME = 'persist-consent';

interface Input extends PersistConsentInput {
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { appointmentId, secrets } = validateInput(input);
    const oystehr = await createOystehr(input.accessToken!, secrets);
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
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

function validateInput(input: ZambdaInput): Input {
  const { appointmentId } = validateJsonBody(input);
  return {
    appointmentId: validateString(appointmentId, 'appointmentId'),
    secrets: input.secrets,
  };
}

async function createOystehr(token: string, secrets: Secrets | null): Promise<Oystehr> {
  return createOystehrClient(
    token,
    getSecret(SecretsKeys.FHIR_API, secrets),
    getSecret(SecretsKeys.PROJECT_API, secrets)
  );
}
