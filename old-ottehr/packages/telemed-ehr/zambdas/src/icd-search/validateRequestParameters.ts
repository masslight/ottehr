import { IcdSearchRequestParams, Secrets } from 'ehr-utils';
import { ZambdaInput } from '../types';

export function validateRequestParameters(input: ZambdaInput): IcdSearchRequestParams & { secrets: Secrets | null } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { search } = JSON.parse(input.body);

  return {
    search: search || '',
    secrets: input.secrets,
  };
}
