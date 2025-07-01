import { IcdSearchRequestParams, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): IcdSearchRequestParams & { secrets: Secrets | null } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { search, sabs, radiologyOnly } = JSON.parse(input.body);

  if (radiologyOnly != undefined && typeof radiologyOnly !== 'boolean') {
    throw new Error('Invalid radiologyOnly parameter. It must be a boolean.');
  }

  return {
    search: search || '',
    sabs,
    radiologyOnly,
    secrets: input.secrets,
  };
}
