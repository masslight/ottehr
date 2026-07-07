import {
  GetAllPracticeManagedPaperworkInput,
  GetAllPracticeManagedPaperworkInputSchema,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest = BaseContext & GetAllPracticeManagedPaperworkInput;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let parsed: GetAllPracticeManagedPaperworkInput;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validated = safeValidate(GetAllPracticeManagedPaperworkInputSchema, parsed);

  const { appointmentId } = validated;

  return {
    appointmentId,
    secrets,
  };
}
