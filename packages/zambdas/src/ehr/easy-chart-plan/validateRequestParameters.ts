import { ChartPlanRequestSchema } from 'utils/lib/easy-chart/api';
import { Secrets } from 'utils/lib/secrets';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validate-zod';

export function validateRequestParameters(
  input: ZambdaInput
): z.output<typeof ChartPlanRequestSchema> & { secrets: Secrets } {
  return validateWithSchema(ChartPlanRequestSchema, input);
}
