import { ResultsLabOrderInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): ResultsLabOrderInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { serviceRequest } = JSON.parse(input.body);

  if (serviceRequest === undefined) {
    throw new Error('These fields are required: "serviceRequest"');
  }

  return {
    serviceRequest,
    secrets: input.secrets,
  };
}
