import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Task } from 'fhir/r4b';
import { BILLING_CLAIM_TASK_CODING } from 'utils/lib/types/data/billing/billing.constants';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { findBillingClaimForEncounter } from '../payments';
import { createBillingClient, fetchById } from '../shared';
import { CreateBillingClaimTaskParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'create-billing-claim-task';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, params.secrets);
  const billingOystehr = createBillingClient(m2mToken, params.secrets);

  const encounter = await complexValidation(clinicalOystehr, params);
  const response = await performEffect(billingOystehr, params, encounter);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function complexValidation(oystehr: Oystehr, params: CreateBillingClaimTaskParams): Promise<Encounter> {
  return fetchById<Encounter>(oystehr, 'Encounter', params.encounterId);
}

async function performEffect(
  oystehr: Oystehr,
  params: CreateBillingClaimTaskParams,
  encounter: Encounter
): Promise<{ taskId: string } | { claimId: string }> {
  const existingClaim = await findBillingClaimForEncounter(oystehr, params.encounterId);
  if (existingClaim?.id) return { claimId: existingClaim.id };

  // Re-signing reuses the task. Failed tasks are retried from the billing queue.
  const taskParams = [
    { name: 'code', value: `${BILLING_CLAIM_TASK_CODING.system}|${BILLING_CLAIM_TASK_CODING.code}` },
    { name: 'encounter', value: `Encounter/${params.encounterId}` },
    { name: 'status', value: 'draft,requested,received,accepted,ready,in-progress,on-hold,completed,failed' },
  ];
  const existingTask = (
    await oystehr.fhir.search<Task>({ resourceType: 'Task', params: [...taskParams, { name: '_count', value: '1' }] })
  ).unbundle()[0];
  if (existingTask?.id) return { taskId: existingTask.id };

  const task = await oystehr.fhir.create<Task>(
    {
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      code: { coding: [BILLING_CLAIM_TASK_CODING] },
      description: 'Create billing claim',
      authoredOn: new Date().toISOString(),
      for: encounter.subject,
      encounter: { reference: `Encounter/${params.encounterId}` },
    },
    { ifNoneExist: taskParams }
  );
  return { taskId: task.id };
}
