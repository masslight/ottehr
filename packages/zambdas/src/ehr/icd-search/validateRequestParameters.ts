import { IcdSearchRequestParams, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): IcdSearchRequestParams & { secrets: Secrets | null } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { search, sabs } = JSON.parse(input.body);

  return {
    search: search || '',
    sabs,
    secrets: input.secrets,
  };
}
