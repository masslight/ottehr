import { Secrets } from 'utils/lib/secrets';
import {
  UpdateVitalsAlertConfigInput,
  UpdateVitalsAlertConfigInputSchema,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { getVitalsAlertConfigEngineError } from 'utils/lib/utils/vitals-alert-config';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export type ValidatedParams = UpdateVitalsAlertConfigInput & { secrets: Secrets };

export function validateRequestParameters(input: ZambdaInput): ValidatedParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = safeValidate(UpdateVitalsAlertConfigInputSchema, safeJsonParse(input.body));

  const engineError = getVitalsAlertConfigEngineError(parsed.config);
  if (engineError) throw INVALID_INPUT_ERROR(engineError);

  return { ...parsed, secrets: input.secrets };
}
