import { SubmitLabOrderInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SubmitLabOrderInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { serviceRequestID, accountNumber, data } = JSON.parse(input.body);

  if (!serviceRequestID || !accountNumber || !data) {
    throw new Error(
      `These fields are required: "serviceRequestID", "accountNumber", "data". Received: ${JSON.stringify(
        {
          serviceRequestID,
          accountNumber,
          data,
        },
        null,
        2
      )}`
    );
  }

  return {
    serviceRequestID,
    accountNumber,
    data,
    secrets: input.secrets,
  };
}
