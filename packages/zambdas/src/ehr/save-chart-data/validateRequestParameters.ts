import {
  isValidSupplementalO2FlowRate,
  SUPPLEMENTAL_O2_DELIVERY_TYPE_OTHER_MAX_LENGTH,
} from 'utils/lib/helpers/vitals/vitals-oxygen-saturation.helper';
import { isRepairDepthSelection, REPAIR_DEPTH_OPTIONS } from 'utils/lib/procedure-coding/format';
import { isStructuredFacts } from 'utils/lib/procedure-coding/structured-fields';
import { isPlausibleLengthCm, MAX_PLAUSIBLE_LENGTH_CM } from 'utils/lib/procedure-coding/validation';
import { VitalsSupplementalO2DeliveryType } from 'utils/lib/types/api/chart-data/chart-data.constants';
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
    structuredFacts: z.custom(isStructuredFacts).optional(),
    lengthCm: lengthCmSchema.optional(),
    repairDepth: repairDepthSchema.optional(),
    infusionStartTime: clockTimeSchema.optional(),
    infusionStopTime: clockTimeSchema.optional(),
  })
  .passthrough();

const supplementalO2Schema = z.object({
  flowRate: z.number().refine(isValidSupplementalO2FlowRate, { message: 'must be a non-negative number' }).optional(),
  deliveryType: z.nativeEnum(VitalsSupplementalO2DeliveryType).optional(),
  deliveryTypeOther: z.string().max(SUPPLEMENTAL_O2_DELIVERY_TYPE_OTHER_MAX_LENGTH).optional(),
});

// Vitals arrive in vitalsObservations, but save-chart-data also saves a vital sent in observations.
const observationSchema = z
  .object({
    supplementalO2: supplementalO2Schema.optional(),
  })
  .passthrough();

const SaveChartDataBodySchema = z
  .object({
    encounterId: z.string().uuid(),
    procedures: z.array(procedureSchema).optional(),
    cleanupProcedureDiagnoses: z.boolean().optional(),
    observations: z.array(observationSchema).optional(),
    vitalsObservations: z.array(observationSchema).optional(),
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
