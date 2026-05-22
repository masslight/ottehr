import { DeleteChartDataRequest } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): DeleteChartDataRequest & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (input.headers.Authorization === undefined) {
    throw new Error('Authorization header is required');
  }

  const data = JSON.parse(input.body) as DeleteChartDataRequest;

  const { encounterId } = data;

  if (encounterId === undefined) {
    throw new Error('These fields are required: "encounterId"');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return {
    ...data,
    secrets: input.secrets,
    userToken,
  };
}
