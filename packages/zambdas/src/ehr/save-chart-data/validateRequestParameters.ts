import { SaveChartDataRequest } from 'utils/lib/types/api/chart-data/save-chart-data.types';
import { MISSING_REQUEST_BODY, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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
