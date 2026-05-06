import { MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export interface SyncMailedStatementStatusesInput {
  secrets: Secrets;
  batchSize?: number;
}

export function validateRequestParameters(input: ZambdaInput): SyncMailedStatementStatusesInput {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const body = typeof input.body === 'string' ? JSON.parse(input.body) : input.body;
  const batchSize = body?.batchSize != null ? Number(body.batchSize) : undefined;

  return {
    secrets: input.secrets,
    batchSize,
  };
}
