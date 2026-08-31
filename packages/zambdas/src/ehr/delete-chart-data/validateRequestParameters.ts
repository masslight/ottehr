import { DeleteChartDataRequest } from 'utils/lib/types/api/chart-data/delete-chart-data.types';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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
