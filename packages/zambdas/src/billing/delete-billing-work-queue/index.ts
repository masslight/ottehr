import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { DeletedResponse } from 'utils/lib/types/data/billing/billing.types';
import { DeleteBillingWorkQueueInputSchema } from 'utils/lib/types/data/billing/work-queue.schemas';
import { FHIR_RESOURCE_NOT_FOUND, PRECONDITION_FAILED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { createBillingClient } from '../shared';
import { findWorkQueuesList, withoutWorkQueue } from '../work-queues/serialization';

let m2mToken: string;
const ZAMBDA_NAME = 'delete-billing-work-queue';
// Every queue lives in one List, so a delete can race a save of another queue. A delete that
// loses re-reads the List and tries again rather than failing the user.
const MAX_DELETE_ATTEMPTS = 3;

export type DeleteBillingWorkQueueParams = ValidatedZambdaInput<typeof DeleteBillingWorkQueueInputSchema>;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(DeleteBillingWorkQueueInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(oystehr: Oystehr, params: DeleteBillingWorkQueueParams): Promise<DeletedResponse> {
  for (let attempt = 1; ; attempt++) {
    const existing = await findWorkQueuesList(oystehr);
    const holdsQueue = existing?.contained?.some((r) => r.resourceType === 'Basic' && r.id === params.queueId);
    if (!existing?.id || !holdsQueue) throw FHIR_RESOURCE_NOT_FOUND('Basic');
    try {
      await oystehr.fhir.update<List>(withoutWorkQueue(existing, params.queueId), {
        optimisticLockingVersionId: existing.meta?.versionId,
      });
      return { deleted: true };
    } catch (error) {
      if (!(error instanceof Oystehr.OystehrFHIRError && error.code === 412)) throw error;
      if (attempt >= MAX_DELETE_ATTEMPTS) {
        throw PRECONDITION_FAILED('The work queues were changed by someone else. Please try again.');
      }
    }
  }
}
