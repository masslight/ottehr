import { Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export interface SyncMailedStatementStatusesInput {
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): SyncMailedStatementStatusesInput {
  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }

  return {
    secrets: input.secrets,
  };
}
