import { Secrets } from 'utils/lib/secrets';
import {
  PrintablePdfInputSchema,
  PrintablePdfZambdaInput,
} from 'utils/lib/types/api/print-chart-data/print-chart-data.types';
import { MISSING_REQUEST_BODY, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export type PrintablePdfInputValidated = PrintablePdfZambdaInput & {
  secrets: Secrets | null;
  userToken: string;
};

/**
 * Shared request validation for the print endpoints, which all take the same input.
 *
 * Kept in one place so the two cannot drift into validating the same field differently; each
 * endpoint still has its own `validateRequestParameters` so the zambda layout stays predictable.
 */
export function validatePrintablePdfRequest(input: ZambdaInput): PrintablePdfInputValidated {
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
