import { MISSING_REQUEST_BODY, NOT_AUTHORIZED, SaveChartDataRequest } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const SaveChartDataBodySchema = z
  .object({
    encounterId: z.string().uuid(),
  })
  .passthrough();

export function validateRequestParameters(
  input: ZambdaInput
): SaveChartDataRequest & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  if (input.headers.Authorization === undefined) {
    throw NOT_AUTHORIZED;
  }

  const data = safeValidate(SaveChartDataBodySchema, safeJsonParse(input.body));
  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return { ...(data as SaveChartDataRequest), secrets: input.secrets, userToken };
}
