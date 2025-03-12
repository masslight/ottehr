import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, Secrets, SecretsKeys, validateJsonBody, validateString, ZambdaInput } from 'zambda-utils';
import { QuestionnaireResponse } from 'fhir/r4b';
import { createOystehrClient } from 'utils';
import { getAuth0Token } from '../../shared';
import Oystehr from '@oystehr/sdk';
import { invokeChatbot } from '../common';

const INITIAL_USER_MESSAGE =
  'Perform a medical history intake session with me by asking me relevant questions. Ask one question at a time.';

let oystehrToken: string;

interface Input {
  encounterId: string;
  secrets: Secrets | null;
}

interface Output {
  questionnaireResponse: QuestionnaireResponse;
}

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const chatbotResponse = await invokeChatbot([{ role: 'user', content: INITIAL_USER_MESSAGE }]);
    const { encounterId, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    const questionnaireResponse = await oystehr.fhir.create<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      status: 'in-progress',
      encounter: {
        reference: 'Encounter/' + encounterId,
      },
      item: [
        {
          linkId: '0',
          answer: [
            {
              valueString: INITIAL_USER_MESSAGE,
            },
          ],
        },
      ],
      contained: [
        {
          resourceType: 'Questionnaire',
          id: 'questionnaire',
          status: 'active',
          item: [
            {
              linkId: '0',
              text: 'Initial message',
              type: 'text',
            },
            {
              linkId: '1',
              text: chatbotResponse.content.toString(),
              type: 'text',
            },
          ],
        },
      ],
      extension: [
        {
          url: 'questionnaire',
          valueReference: {
            reference: '#questionnaire',
          },
        },
      ],
    });
    const output: Output = {
      questionnaireResponse,
    };
    return {
      statusCode: 200,
      body: JSON.stringify(output),
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
  const { encounterId } = validateJsonBody(input);
  return {
    encounterId: validateString(encounterId, 'encounterId'),
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
