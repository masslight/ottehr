import { GetChartDataRequest } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const GetChartDataSchema = z.object({
  encounterId: z.string().uuid(),
  requestedFields: z.record(z.string(), z.any()).optional(),
});

export function validateRequestParameters(input: ZambdaInput): GetChartDataRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsedJSON = safeJsonParse(input.body);

  const { encounterId, requestedFields } = safeValidate(GetChartDataSchema, parsedJSON);

  return {
    encounterId,
    secrets: input.secrets,
    requestedFields,
  };
}
