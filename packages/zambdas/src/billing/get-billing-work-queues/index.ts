import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { claimsListFiltersToSearchInput } from 'utils/lib/types/data/billing/claims-list-view.schemas';
import {
  GetBillingWorkQueuesResponse,
  WorkQueue,
  WorkQueueSummary,
} from 'utils/lib/types/data/billing/work-queue.schemas';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { mapWithConcurrency } from '../../shared/concurrency';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { buildClaimFilterParams, scanMatchingClaims } from '../claim-search';
import { createBillingClient } from '../shared';
import { findWorkQueuesList, listToWorkQueues } from '../work-queues/serialization';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-work-queues';
// Each queue's figures take one claim scan; few queues exist, but don't fire every scan at once.
const QUEUE_STATS_CONCURRENCY = 4;

// Returns every work queue with the number of claims it currently holds and their billed total.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const response = await performEffect(oystehr);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(oystehr: Oystehr): Promise<GetBillingWorkQueuesResponse> {
  const queues = listToWorkQueues(await findWorkQueuesList(oystehr));
  return {
    queues: await mapWithConcurrency(queues, QUEUE_STATS_CONCURRENCY, (queue) => summarizeWorkQueue(oystehr, queue)),
  };
}

export async function summarizeWorkQueue(oystehr: Oystehr, queue: WorkQueue): Promise<WorkQueueSummary> {
  try {
    const params = claimsListFiltersToSearchInput(queue.filters);
    const filterParams = await buildClaimFilterParams({
      oystehr,
      params,
      // A stable order, so a claim edited mid-scan can't shift the offset pages. The search text
      // clauses keep the list's order, as they truncate at a match limit and should keep the newest.
      sort: params.searchText ? undefined : '_id',
    });
    const { claims, incomplete } = await scanMatchingClaims({ oystehr, params, filterParams, withTotal: true });
    const charged = claims.reduce((sum, claim) => sum + (claim.total?.value ?? 0), 0);
    return { ...queue, claimCount: claims.length, charged: Math.round(charged * 100) / 100, incomplete };
  } catch (error) {
    // One queue whose filters no longer resolve mustn't take the whole list down.
    console.error(`[work-queues] couldn't count the claims in work queue ${queue.id}:`, error);
    return { ...queue, claimCount: null, charged: null, incomplete: false };
  }
}
