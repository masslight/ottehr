import {
  CreateDischargeSummaryInputSchema,
  CreateDischargeSummaryInputValidated,
  MISSING_REQUEST_BODY,
  NOT_AUTHORIZED,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): CreateDischargeSummaryInputValidated {
  console.group('validateRequestParameters');

  if (!input.headers?.Authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsedJSON = JSON.parse(input.body) as unknown;

  const validatedParams = safeValidate(CreateDischargeSummaryInputSchema, parsedJSON);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    ...validatedParams,
    secrets: input.secrets,
    userToken,
  };
}
