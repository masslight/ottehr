import {
  UpdateVitalsAlertConfigInputSchema,
  UpdateVitalsAlertConfigInputValidated,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): UpdateVitalsAlertConfigInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const authHeader = input.headers?.Authorization;
  if (!authHeader) {
    throw MISSING_AUTH_TOKEN;
  }

  const userToken = authHeader.replace('Bearer ', '');

  const data = safeValidate(UpdateVitalsAlertConfigInputSchema, safeJsonParse(input.body));

  return {
    ...data,
    secrets: input.secrets,
    userToken,
  };
}
