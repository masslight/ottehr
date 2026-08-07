import {
  CreateDischargeSummaryInputSchema,
  CreateDischargeSummaryInputValidated,
} from 'utils/lib/types/api/create-discharge-summary/create-discharge-summary.types';
import { MISSING_REQUEST_BODY, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): CreateDischargeSummaryInputValidated {
  console.group('validateRequestParameters');

  if (!input.headers?.Authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsedJSON = safeJsonParse(input.body) as unknown;

  const validatedParams = safeValidate(CreateDischargeSummaryInputSchema, parsedJSON);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    ...validatedParams,
    secrets: input.secrets,
    userToken,
  };
}
