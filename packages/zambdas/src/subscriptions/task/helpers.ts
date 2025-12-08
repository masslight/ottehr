import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult, Handler } from 'aws-lambda';
import { RelatedPerson, Task } from 'fhir/r4b';
import {
  createOystehrClient as createOystehrClientUtils,
  getSecret,
  getSMSNumberForIndividual,
  Secrets,
  SecretsKeys,
  TaskStatus,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  sendErrors,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { patchTaskStatus } from '../helpers';
import { TaskSubscriptionInput } from './sub-send-claim';
import { validateRequestParameters } from './validateRequestParameters';

export const getDocReferenceIDFromFocus = (task: Task): string => {
  const ref = task.focus?.reference;
  if (!ref) {
    throw `no reference found on Task ${task.id}`;
  }
  const [resource, id] = ref.split('/');
  if (resource !== 'DocumentReference') {
    throw `no DocRef specified as focus on Task ${task.id}`;
  }
  if (!id) {
    throw `no DocRef id missing in focus on Task ${task.id}`;
  }
  return id;
};

export const sendText = async (
  message: string,
  fhirRelatedPerson: RelatedPerson,
  oystehrToken: string,
  secrets: Secrets | null
): Promise<{ taskStatus: TaskStatus; statusReason: string | undefined }> => {
  let taskStatus: TaskStatus, statusReason: string | undefined;
  const smsNumber = getSMSNumberForIndividual(fhirRelatedPerson);
  if (smsNumber) {
    console.log('sending message to', smsNumber);
    const messageRecipient = `RelatedPerson/${fhirRelatedPerson.id}`;
    const oystehr = createOystehrClientUtils(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );
    try {
      const result = await oystehr.transactionalSMS.send({
        message,
        resource: messageRecipient,
      });
      console.log('send SMS result', result);
      taskStatus = 'completed';
      statusReason = 'text sent successfully';
    } catch (e) {
      console.log('message send error: ', JSON.stringify(e));
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
      void sendErrors(e, ENVIRONMENT);
      taskStatus = 'failed';
      statusReason = `failed to send text to ${smsNumber}`;
    }
  } else {
    taskStatus = 'failed';
    statusReason = `could not retrieve sms number for related person ${fhirRelatedPerson.id}`;
    console.log('Could not find sms number. Skipping sending text');
  }
  return { taskStatus, statusReason };
};

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
let oystehr: Oystehr;

export function wrapTaskHandler(
  zambdaName: string,
  handler: (
    input: { task: Task; secrets: Secrets },
    oystehr: Oystehr
  ) => Promise<{ taskStatus: Task['status']; statusReason?: string }>,
  options: { retry: boolean } = { retry: false }
): Handler<ZambdaInput, APIGatewayProxyResult> {
  return wrapHandler(zambdaName, async (input: ZambdaInput) => {
    let params: TaskSubscriptionInput;
    let taskId: string;
    let ENVIRONMENT: string;
    try {
      params = validateRequestParameters(input);
      const taskIdParam = params.task.id;
      if (!taskIdParam) {
        throw new Error('Task ID is missing in the input parameters');
      }
      taskId = taskIdParam;
      ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      oystehrToken = await checkOrCreateM2MClientToken(oystehrToken, input.secrets);
      oystehr = createOystehrClient(oystehrToken, input.secrets);
    } catch (error) {
      console.log('Error validating request parameters:', error);
      return topLevelCatch(zambdaName, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
    }

    try {
      await markTaskInProgress(taskId, oystehr);
    } catch (error) {
      console.error('Error patching task status to in-progress:', error);
      try {
        await markTaskFailed(
          taskId,
          oystehr,
          `Failed to mark task in-progress: ${JSON.stringify(error)}`,
          options.retry
        );
      } catch (patchError) {
        console.error('Error patching task status in top level catch:', patchError);
      }
      return topLevelCatch(zambdaName, error, ENVIRONMENT);
    }

    try {
      const result = await handler(params, oystehr);
      await markTaskCompleted(taskId, oystehr, result.taskStatus, result.statusReason);
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error: any) {
      try {
        await markTaskFailed(taskId, oystehr, JSON.stringify(error), options.retry);
      } catch (patchError) {
        console.error('Error patching task status in top level catch:', patchError);
      }
      return topLevelCatch(zambdaName, error, ENVIRONMENT);
    }
  });
}

async function markTaskInProgress(taskId: string, oystehr: Oystehr): Promise<void> {
  await patchTaskStatus(
    { task: { id: taskId }, taskStatusToUpdate: 'in-progress', statusReasonToUpdate: 'started processing' },
    oystehr
  );
}

async function markTaskCompleted(
  taskId: string,
  oystehr: Oystehr,
  status: Task['status'],
  reason?: string
): Promise<void> {
  await patchTaskStatus(
    { task: { id: taskId }, taskStatusToUpdate: status, statusReasonToUpdate: reason ?? 'completed successfully' },
    oystehr
  );
}

async function markTaskFailed(taskId: string, oystehr: Oystehr, reason: string, retry: boolean = false): Promise<void> {
  await patchTaskStatus(
    {
      task: { id: taskId },
      taskStatusToUpdate: retry ? 'ready' : 'failed',
      statusReasonToUpdate: retry ? '' : reason,
    },
    oystehr
  );
}
