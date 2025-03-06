import { GetLabOrderDetailsInput } from 'utils';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): GetLabOrderDetailsInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { serviceRequestID } = JSON.parse(input.body);

  if (serviceRequestID === undefined) {
    throw new Error('These fields are required: "serviceRequestID"');
  }

  return {
    serviceRequestID,
    secrets: input.secrets,
  };
}
