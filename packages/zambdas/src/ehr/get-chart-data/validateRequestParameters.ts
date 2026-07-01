import { GetChartDataRequest, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

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
