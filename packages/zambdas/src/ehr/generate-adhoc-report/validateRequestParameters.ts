import {
  GenerateAdHocReportInput,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GenerateAdHocReportInput & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { schema, request, conversation, previousAttempt } = JSON.parse(input.body);

  if (!schema || typeof schema !== 'object') {
    throw MISSING_REQUIRED_PARAMETERS(['schema']);
  }

  if (!request || typeof request !== 'string' || request.trim().length === 0) {
    throw MISSING_REQUIRED_PARAMETERS(['request']);
  }

  if (conversation !== undefined && !Array.isArray(conversation)) {
    throw INVALID_INPUT_ERROR('conversation must be an array');
  }

  if (
    previousAttempt !== undefined &&
    (typeof previousAttempt !== 'object' ||
      previousAttempt === null ||
      typeof previousAttempt.code !== 'string' ||
      typeof previousAttempt.error !== 'string')
  ) {
    throw INVALID_INPUT_ERROR('previousAttempt must be an object with string "code" and "error" fields');
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  return { schema, request, conversation, previousAttempt, secrets: input.secrets };
}
