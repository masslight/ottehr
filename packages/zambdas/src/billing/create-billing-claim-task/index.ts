import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Task } from 'fhir/r4b';
import { BILLING_CLAIM_TASK_CODING } from 'utils/lib/types/data/billing/billing.constants';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
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
): Promise<{ taskId: string }> {
  const task = await oystehr.fhir.create<Task>({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    code: { coding: [BILLING_CLAIM_TASK_CODING] },
    description: 'Create billing claim',
    authoredOn: new Date().toISOString(),
    for: encounter.subject,
    encounter: { reference: `Encounter/${params.encounterId}` },
    focus: { reference: `Encounter/${params.encounterId}` }, // TODO: check if needed
  });
  return { taskId: task.id };
}
