import { IcdSearchRequestParams } from 'utils';
import { Secrets } from 'zambda-utils';
import { ZambdaInput } from 'zambda-utils';

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
