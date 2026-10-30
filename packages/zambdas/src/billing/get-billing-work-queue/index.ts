import { APIGatewayProxyResult } from 'aws-lambda';
import {
  BillingWorkQueueResponse,
  GetBillingWorkQueueInput,
  GetBillingWorkQueueInputSchema,
} from 'utils/lib/types/data/billing/work-queue.schemas';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { BillingOystehr, createBillingClient } from '../shared';
import { findWorkQueuesList, listToWorkQueues } from '../work-queues/serialization';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-work-queue';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(GetBillingWorkQueueInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: BillingOystehr,
  params: GetBillingWorkQueueInput
): Promise<BillingWorkQueueResponse> {
  const queue = listToWorkQueues(await findWorkQueuesList(oystehr)).find((q) => q.id === params.queueId);
  if (!queue) throw FHIR_RESOURCE_NOT_FOUND('Basic');
  return { queue };
}
