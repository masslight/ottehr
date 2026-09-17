import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { BILLING_CLAIM_TASK_CODING } from 'utils/lib/types/data/billing/billing.constants';
import { SearchBillingClaimTasksResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient } from '../shared';
import { SearchBillingClaimTasksParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-claim-tasks';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  complexValidation(params);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

function complexValidation(params: SearchBillingClaimTasksParams): void {
  if (params.createdFrom && params.createdTo && params.createdFrom > params.createdTo) {
    throw INVALID_INPUT_ERROR('Creation start date must not be after end date');
  }
}

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingClaimTasksParams
): Promise<SearchBillingClaimTasksResponse> {
  const { status, createdFrom, createdTo, patientId, offset, pageSize } = params;
  const searchParams = [
    { name: 'code', value: `${BILLING_CLAIM_TASK_CODING.system}|${BILLING_CLAIM_TASK_CODING.code}` },
    { name: '_sort', value: '-authored-on,-_id' },
    { name: '_count', value: String(pageSize) },
    { name: '_offset', value: String(offset) },
    { name: '_total', value: 'accurate' },
  ];
  if (status) searchParams.push({ name: 'status', value: status });
  if (createdFrom) searchParams.push({ name: 'authored-on', value: `ge${createdFrom}` });
  if (createdTo) searchParams.push({ name: 'authored-on', value: `le${createdTo}` });
  if (patientId) searchParams.push({ name: 'subject', value: `Patient/${patientId}` });

  const bundle = await oystehr.fhir.search<Task>({ resourceType: 'Task', params: searchParams });
  const tasks = bundle.unbundle().map((task) => ({
    id: task.id!,
    status: task.status,
    encounterId: task.encounter?.reference?.split('/')[1],
    patientId: task.for?.reference?.split('/')[1],
    createdAt: task.authoredOn,
    updatedAt: task.meta?.lastUpdated,
    error: getFailureMessage(task),
  }));
  return { tasks, total: bundle.total ?? 0, offset, pageSize };
}

function getFailureMessage(task: Task): string | undefined {
  if (task.status !== 'failed') return undefined;
  const reason = task.statusReason?.text;
  if (!reason) return 'Claim creation failed';
  try {
    const error: unknown = JSON.parse(reason);
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
  } catch {
    // Task failures may already be stored as plain text.
  }
  return reason;
}
