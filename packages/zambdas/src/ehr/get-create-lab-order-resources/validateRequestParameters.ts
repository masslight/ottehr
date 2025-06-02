import { GetCreateLabOrderResources } from 'utils';
import { ZambdaInput } from '../../shared';
import { MISSING_REQUIRED_PARAMETERS } from 'utils';

export function validateRequestParameters(input: ZambdaInput): GetCreateLabOrderResources & { secrets: any } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { patientId, search } = JSON.parse(input.body);

  const missingResources = [];
  if (!patientId) missingResources.push('patientId');
  if (missingResources.length) {
    throw MISSING_REQUIRED_PARAMETERS(missingResources);
  }

  return {
    patientId,
    search,
    secrets: input.secrets,
  };
}
