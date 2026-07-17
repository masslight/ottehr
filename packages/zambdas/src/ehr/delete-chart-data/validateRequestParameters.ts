import { DeleteChartDataRequest } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const DeleteChartDataBodySchema = z
  .object({
    encounterId: z.string(),
  })
  .passthrough();

export function validateRequestParameters(input: ZambdaInput): DeleteChartDataRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const data = safeValidate(DeleteChartDataBodySchema, safeJsonParse(input.body));

  return {
    ...(data as DeleteChartDataRequest),
    secrets: input.secrets,
  };
}
