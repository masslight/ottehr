import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { createInvoiceTaskInput, getSecret, SecretsKeys, USER_TIMEZONE_EXTENSION_URL } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'update-invoice-task';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParams = validateRequestParameters(input);
    const { secrets, taskId, status, prefilledInvoiceInfo, userTimezone } = validatedParams;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const taskInput = createInvoiceTaskInput(prefilledInvoiceInfo);

    const task = await oystehr.fhir.get<Task>({
      resourceType: 'Task',
      id: taskId,
    });

    task.status = status as any;
    task.input = taskInput;

    if (!task.extension) {
      task.extension = [];
    }
    task.extension.push({
      url: USER_TIMEZONE_EXTENSION_URL,
      valueString: userTimezone,
    });

    await oystehr.fhir.update(task);

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
