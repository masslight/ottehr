import { isPlausibleLengthCm, MAX_PLAUSIBLE_LENGTH_CM } from 'utils/lib/procedure-coding/extract';
import { isRepairDepthSelection, REPAIR_DEPTH_OPTIONS } from 'utils/lib/procedure-coding/format';
import { SaveChartDataRequest } from 'utils/lib/types/api/chart-data/save-chart-data.types';
import { MISSING_REQUEST_BODY, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a 24-hour HH:MM time');

const repairDepthSchema = z.string().refine(isRepairDepthSelection, {
  message: `must be one of: ${REPAIR_DEPTH_OPTIONS.map((option) => option.value).join(', ')}`,
});

const lengthCmSchema = z
  .number()
  .refine(isPlausibleLengthCm, { message: `must be greater than 0 and at most ${MAX_PLAUSIBLE_LENGTH_CM} cm` });

const procedureSchema = z
  .object({
    lengthCm: lengthCmSchema.optional(),
    repairDepth: repairDepthSchema.optional(),
    infusionStartTime: clockTimeSchema.optional(),
    infusionStopTime: clockTimeSchema.optional(),
  })
  .passthrough();

const SaveChartDataBodySchema = z
  .object({
    encounterId: z.string().uuid(),
    procedures: z.array(procedureSchema).optional(),
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
