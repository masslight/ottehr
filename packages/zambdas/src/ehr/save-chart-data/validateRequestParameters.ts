import { SaveChartDataRequest } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const SaveChartDataBodySchema = z
  .object({
    encounterId: z.string().uuid(),
  })
  .passthrough();

export function validateRequestParameters(
  input: ZambdaInput
): SaveChartDataRequest & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (input.headers.Authorization === undefined) {
    throw new Error('Authorization token is not provided in headers');
  }

  const data = safeValidate(SaveChartDataBodySchema, JSON.parse(input.body));
  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return { ...(data as SaveChartDataRequest), secrets: input.secrets, userToken };
}
