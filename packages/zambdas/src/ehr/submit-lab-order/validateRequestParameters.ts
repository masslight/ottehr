import { SubmitLabOrderInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SubmitLabOrderInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { serviceRequestID, data } = JSON.parse(input.body);

  if (serviceRequestID === undefined || data === undefined) {
    throw new Error('These fields are required: "serviceRequestID", "data');
  }

  return {
    serviceRequestID,
    data,
    secrets: input.secrets,
  };
}
