import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Task } from 'fhir/r4b';
import { BILLING_CLAIM_TASK_CODING } from 'utils/lib/types/data/billing/billing.constants';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient, fetchById } from '../shared';
import { RetryBillingClaimTaskParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'retry-billing-claim-task';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const task = await complexValidation(oystehr, params);
  const response = await performEffect(oystehr, params, task);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function complexValidation(oystehr: Oystehr, params: RetryBillingClaimTaskParams): Promise<Task> {
  const task = await fetchById<Task>(oystehr, 'Task', params.taskId);
  const isBillingClaimTask = task.code?.coding?.some(
    ({ system, code }) => system === BILLING_CLAIM_TASK_CODING.system && code === BILLING_CLAIM_TASK_CODING.code
  );
  if (!isBillingClaimTask) throw INVALID_INPUT_ERROR('Only billing claim creation tasks can be retried');
  if (task.status !== 'failed') throw INVALID_INPUT_ERROR('Only failed billing claim creation tasks can be retried');
  return task;
}

async function performEffect(
  oystehr: Oystehr,
  params: RetryBillingClaimTaskParams,
  task: Task
): Promise<{ taskId: string }> {
  const operations: Operation[] = [{ op: 'replace', path: '/status', value: 'requested' }];
  if (task.statusReason) operations.push({ op: 'remove', path: '/statusReason' });

  await oystehr.fhir.patch<Task>(
    { resourceType: 'Task', id: params.taskId, operations },
    { optimisticLockingVersionId: task.meta?.versionId }
  );
  return { taskId: params.taskId };
}
