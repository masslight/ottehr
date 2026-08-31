import { Secrets } from 'utils/lib/secrets';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse } from '../../shared/validation';

export interface SyncMailedStatementStatusesInput {
  secrets: Secrets;
  batchSize?: number;
}

export function validateRequestParameters(input: ZambdaInput): SyncMailedStatementStatusesInput {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const body = typeof input.body === 'string' ? safeJsonParse(input.body) : input.body;
  const batchSize = body?.batchSize != null ? Number(body.batchSize) : undefined;

  return {
    secrets: input.secrets,
    batchSize,
  };
}
