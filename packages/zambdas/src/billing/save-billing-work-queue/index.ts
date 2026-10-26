import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { List } from 'fhir/r4b';
import {
  BillingWorkQueueResponse,
  SaveBillingWorkQueueInputSchema,
  WorkQueue,
} from 'utils/lib/types/data/billing/work-queue.schemas';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR, PRECONDITION_FAILED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
// eslint-disable-next-line no-restricted-imports -- owners' Practitioners are the users' clinical profiles
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { createBillingClient } from '../shared';
import { listWorkQueueOwners } from '../work-queues/owners';
import { findWorkQueuesLists, listToWorkQueues, withWorkQueue } from '../work-queues/serialization';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-work-queue';
// Every queue lives in one List, so two saves of different queues can race on it. A save that
// loses re-reads the List and tries again rather than failing the user.
const MAX_SAVE_ATTEMPTS = 3;

export type SaveBillingWorkQueueParams = ValidatedZambdaInput<typeof SaveBillingWorkQueueInputSchema>;

// Creates a work queue (no queueId) or replaces an existing one, returning it as saved.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(SaveBillingWorkQueueInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  await complexValidation(oystehr, createClinicalOystehrClient(m2mToken, params.secrets), params);
  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// The owner must be someone the owner picker offers — a Billing Admin.
export async function complexValidation(
  projectClient: Oystehr,
  fhirClient: Oystehr,
  params: SaveBillingWorkQueueParams
): Promise<void> {
  if (!params.owner) return;
  const owners = await listWorkQueueOwners(projectClient, fhirClient);
  if (!owners.some((o) => o.practitionerId === params.owner?.practitionerId)) {
    throw INVALID_INPUT_ERROR('The work queue owner must be a user with the Billing Admin role');
  }
}

export async function performEffect(
  oystehr: Oystehr,
  params: SaveBillingWorkQueueParams
): Promise<BillingWorkQueueResponse> {
  const queue: WorkQueue = {
    id: params.queueId ?? randomUUID(),
    name: params.name,
    ...(params.description ? { description: params.description } : {}),
    ...(params.owner ? { owner: params.owner } : {}),
    filters: params.filters,
    layout: params.layout,
  };

  for (let attempt = 1; ; attempt++) {
    const [existing, ...duplicates] = await findWorkQueuesLists(oystehr);
    await deleteDuplicateLists(oystehr, duplicates);
    if (params.queueId && !listToWorkQueues(existing).some((q) => q.id === params.queueId)) {
      throw FHIR_RESOURCE_NOT_FOUND('Basic');
    }
    const list = withWorkQueue(existing, queue);
    try {
      const saved = existing?.id
        ? await oystehr.fhir.update<List>(list, { optimisticLockingVersionId: existing.meta?.versionId })
        : await oystehr.fhir.create<List>(list);
      const savedQueue = listToWorkQueues(saved).find((q) => q.id === queue.id);
      if (!savedQueue) throw new Error(`Work queue ${queue.id} is missing from the saved List`);
      return { queue: savedQueue };
    } catch (error) {
      if (!(error instanceof Oystehr.OystehrFHIRError && error.code === 412)) throw error;
      if (attempt >= MAX_SAVE_ATTEMPTS) {
        throw PRECONDITION_FAILED('The work queues were changed by someone else. Please try again.');
      }
    }
  }
}

// Lists left behind by racing first-ever saves (see findWorkQueuesLists). Cleanup is best effort — a
// concurrent save may be deleting the same List — so a failure is logged rather than failing the save.
async function deleteDuplicateLists(oystehr: Oystehr, duplicates: List[]): Promise<void> {
  const requests: BatchInputDeleteRequest[] = duplicates
    .filter((list) => list.id)
    .map((list) => ({ method: 'DELETE', url: `/List/${list.id}` }));
  if (!requests.length) return;
  try {
    await oystehr.fhir.batch({ requests });
  } catch (error) {
    console.error(`[work-queues] failed to delete duplicate Lists ${requests.map((r) => r.url).join(', ')}:`, error);
  }
}
