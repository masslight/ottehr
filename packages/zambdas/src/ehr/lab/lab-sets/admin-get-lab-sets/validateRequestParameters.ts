import { Secrets } from 'utils/lib/secrets';
import { AdminGetLabSetDetailInput } from 'utils/lib/types/data/labs/labs.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { ZambdaInput } from '../../../../shared/types/common';
import { safeJsonParse } from '../../../../shared/validation';

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
    params = safeJsonParse(input.body);
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
