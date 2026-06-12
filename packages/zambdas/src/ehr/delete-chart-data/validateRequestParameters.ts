import { DeleteChartDataRequest } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const DeleteChartDataBodySchema = z
  .object({
    encounterId: z.string(),
  })
  .passthrough();

export function validateRequestParameters(input: ZambdaInput): DeleteChartDataRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const data = safeValidate(DeleteChartDataBodySchema, JSON.parse(input.body));

  return {
    ...(data as DeleteChartDataRequest),
    secrets: input.secrets,
  };
}
