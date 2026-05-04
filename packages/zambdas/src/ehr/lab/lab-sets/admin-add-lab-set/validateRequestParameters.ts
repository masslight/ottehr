import {
  AdminAddLabSetInput,
  INVALID_INPUT_ERROR,
  LabSetNoIdDTO,
  LabSetNoIsSchema,
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

  const { labSet } = params;

  if (!labSet) {
    throw MISSING_REQUIRED_PARAMETERS(['labSet']);
  }

  const labSetValidated = LabSetNoIsSchema.parse(labSet);

  return {
    labSet: labSetValidated,
    secrets,
    userToken,
  };
}
