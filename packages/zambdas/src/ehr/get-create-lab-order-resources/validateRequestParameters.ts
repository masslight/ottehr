import { GetCreateLabOrderResources } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetCreateLabOrderResources & { secrets: any } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { encounter } = JSON.parse(input.body);

  const missingResources = [];
  if (!encounter.id) missingResources.push('encounter');
  if (missingResources.length) {
    throw new Error(`missing required resource(s): ${missingResources.join(',')}`);
  }

  return {
    encounter,
    secrets: input.secrets,
  };
}
