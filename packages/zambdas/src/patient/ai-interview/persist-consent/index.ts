import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Consent } from 'fhir/r4b';
import { FHIR_AI_CHAT_CONSENT_CATEGORY_CODE } from 'utils/lib/fhir/constants';
import { PROJECT_WEBSITE } from 'utils/lib/ottehr-config/branding';
import { PersistConsentInput } from 'utils/lib/types/api/ai-interview.types';
import { createOystehrClient } from 'utils/lib/helpers/helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { ZambdaInput } from '../../../shared/types/common';
import { getAuth0Token } from '../../../shared/getAuth0Token';
import { validateJsonBody, validateString } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';

const ZAMBDA_NAME = 'persist-consent';

let oystehrToken: string;

interface Input extends PersistConsentInput {
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
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
});

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
