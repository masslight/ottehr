import { AdminGetLabSetDetailInput, INVALID_INPUT_ERROR, isValidUUID, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { ZambdaInput } from '../../../../shared';

type BaseContext = {
  secrets: Secrets | null;
  userToken: string;
};

type ValidatedRequest =
  | (BaseContext & { type: 'list' })
  | (BaseContext & AdminGetLabSetDetailInput & { type: 'detail' });

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: Partial<AdminGetLabSetDetailInput>;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const { labSetId } = params;

  if (labSetId) {
    if (typeof labSetId !== 'string' || !isValidUUID(labSetId)) {
      throw INVALID_INPUT_ERROR('labSetId must be a valid uuid');
    }

    return {
      type: 'detail',
      labSetId,
      secrets,
      userToken,
    };
  }

  return {
    type: 'list',
    secrets,
    userToken,
  };
}
