import {
  PrintablePdfInputSchema,
  PrintablePdfInputValidated,
} from 'utils/lib/types/api/print-chart-data/print-chart-data.types';
import { MISSING_REQUEST_BODY, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): PrintablePdfInputValidated {
  if (!input.headers?.Authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  return {
    ...safeValidate(PrintablePdfInputSchema, safeJsonParse(input.body) as unknown),
    secrets: input.secrets,
    userToken: input.headers.Authorization.replace('Bearer ', ''),
  };
}
