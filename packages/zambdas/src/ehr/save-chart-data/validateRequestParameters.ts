import { SaveChartDataRequest } from 'utils';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(
  input: ZambdaInput
): SaveChartDataRequest & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (input.headers.Authorization === undefined) {
    throw new Error('Auhtorization token is not provided in headers');
  }

  const data = JSON.parse(input.body) as SaveChartDataRequest;

  if (data.encounterId === undefined) {
    throw new Error('These fields are required: "encounterId"');
  }
  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return { ...data, secrets: input.secrets, userToken: userToken };
}
