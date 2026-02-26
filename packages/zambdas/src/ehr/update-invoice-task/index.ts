import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import {
  createInvoiceTaskInput,
  getExtension,
  getSecret,
  mapDisplayToInvoiceTaskStatus,
  mapInvoiceTaskStatusToDisplay,
  parseInvoiceTaskInput,
  SecretsKeys,
  USER_TIMEZONE_EXTENSION_URL,
} from 'utils';
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
    const { secrets, taskId, status, invoiceTaskInput, userTimezone } = validatedParams;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const task = await oystehr.fhir.get<Task>({
      resourceType: 'Task',
      id: taskId,
    });

    task.status = status as any;
    console.log('New status: ', status);
    if (
      mapInvoiceTaskStatusToDisplay(status as any) === 'updating' &&
      mapInvoiceTaskStatusToDisplay(task.status) === 'updating'
    ) {
      // this is for preventing task stack in "updating" status
      console.log(
        `New status is "${status}", and existing status is also "${
          task.status
        }". Updating Task status to "${mapDisplayToInvoiceTaskStatus(
          'ready'
        )}" first so it'll trigger subscription after updating to "${status}" again.`
      );
      await oystehr.fhir.patch({
        resourceType: 'Task',
        id: taskId,
        operations: [{ op: 'replace', path: '/status', value: mapDisplayToInvoiceTaskStatus('ready') }],
      });
    }
    if (invoiceTaskInput) {
      console.log('Task input: ', JSON.stringify(task.input));
      const exisingTaskInput = parseInvoiceTaskInput(task);
      task.input = createInvoiceTaskInput({
        ...exisingTaskInput,
        ...invoiceTaskInput,
      });
      console.log('Updated task input: ', JSON.stringify(task.input));
    }

    if (!task.extension) {
      task.extension = [];
    }
    const existingTimezoneExtension = getExtension(task, USER_TIMEZONE_EXTENSION_URL);
    if (!existingTimezoneExtension) {
      task.extension.push({
        url: USER_TIMEZONE_EXTENSION_URL,
        valueString: userTimezone,
      });
    } else if (existingTimezoneExtension?.valueString !== userTimezone) {
      task.extension = task.extension.filter((extension) => extension.url !== USER_TIMEZONE_EXTENSION_URL);
      task.extension.push({
        url: USER_TIMEZONE_EXTENSION_URL,
        valueString: userTimezone,
      });
    }

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
