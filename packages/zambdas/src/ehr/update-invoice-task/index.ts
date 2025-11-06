import { APIGatewayProxyResult } from 'aws-lambda';
import { createInvoiceTaskInput, getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'send-invoice-to-patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParams = validateRequestParameters(input);
    const { secrets, taskId, status, prefilledInfo } = validatedParams;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const taskInput = createInvoiceTaskInput(prefilledInfo);

    await oystehr.fhir.patch({
      resourceType: 'Task',
      id: taskId,
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: status,
        },
        {
          op: 'replace',
          path: '/input',
          value: taskInput,
        },
      ],
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Task changed successfully' }),
    };
  } catch (error) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
    console.log('Error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
});
