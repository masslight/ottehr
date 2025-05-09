import { GetCreateLabOrderResources } from 'utils';
import { ZambdaInput } from '../../shared';
import { MISSING_REQUIRED_PARAMETERS } from 'utils';

export function validateRequestParameters(input: ZambdaInput): GetCreateLabOrderResources & { secrets: any } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { encounter } = JSON.parse(input.body);

  const missingResources = [];
  if (!encounter.id) missingResources.push('encounter');
  if (missingResources.length) {
    throw MISSING_REQUIRED_PARAMETERS(missingResources);
  }

  return {
    encounter,
    secrets: input.secrets,
  };
}
