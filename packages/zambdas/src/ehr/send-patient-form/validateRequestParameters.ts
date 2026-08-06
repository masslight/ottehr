import { Secrets } from 'utils/lib/secrets';
import { SendPatientFormInput, sendPatientFormInputSchema } from 'utils/lib/types/data/send-patient-form';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

type BaseContext = {
  secrets: Secrets | null;
  userToken: string;
};

type ValidatedRequest = BaseContext & SendPatientFormInput;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let parsed: SendPatientFormInput;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validated = safeValidate(sendPatientFormInputSchema, parsed);

  const { appointmentId, questionnaireId } = validated;

  return {
    appointmentId,
    questionnaireId,
    secrets,
    userToken,
  };
}
