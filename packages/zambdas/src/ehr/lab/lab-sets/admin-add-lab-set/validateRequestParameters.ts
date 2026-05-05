import {
  AdminAddLabSetInput,
  INVALID_INPUT_ERROR,
  LabSetNoIdDTO,
  LabSetNoIdSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../../../shared';

type BaseContext = {
  secrets: Secrets | null;
  userToken: string;
};

type ValidatedRequest = BaseContext & { labSet: LabSetNoIdDTO };

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: AdminAddLabSetInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const { labSetFormInput } = params;

  if (!labSetFormInput) {
    throw MISSING_REQUIRED_PARAMETERS(['labSetFormInput']);
  }

  const labSetValidated = LabSetNoIdSchema.safeParse(labSetFormInput);
  if (!labSetValidated.success) {
    console.error(
      'Hit validation error during zod parsing. Tried to parse this json:',
      JSON.stringify(labSetValidated.error.errors),
      JSON.stringify(labSetValidated)
    );
    throw INVALID_INPUT_ERROR(`Validation failed for labSetFormInput: ${JSON.stringify(labSetValidated.error.errors)}`);
  }

  return {
    labSet: labSetValidated.data,
    secrets,
    userToken,
  };
}
