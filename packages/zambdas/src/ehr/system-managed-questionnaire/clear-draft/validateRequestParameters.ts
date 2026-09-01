import { Secrets } from 'utils/lib/secrets';
import { ClearSystemManagedDraftInput } from 'utils/lib/types/data/system-managed-questionnaires/system-managed-questionnaire.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';

type ValidatedRequest = { secrets: Secrets | null; url: string };

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let params: ClearSystemManagedDraftInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  if (!params.url) throw MISSING_REQUIRED_PARAMETERS(['url']);
  if (typeof params.url !== 'string') throw INVALID_INPUT_ERROR('url must be a string.');

  return { secrets, url: params.url };
}
