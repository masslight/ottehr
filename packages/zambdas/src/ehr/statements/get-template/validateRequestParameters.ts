import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
} from 'utils/lib/types/errors';
import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

export interface GetStatementTemplateInput {
  template: string;
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): GetStatementTemplateInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const body = safeJsonParse(input.body) as Record<string, unknown>;

  const template = body.template;
  if (typeof template !== 'string' || template.length === 0) {
    throw MISSING_REQUIRED_PARAMETERS(['template']);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(template)) {
    throw INVALID_INPUT_ERROR('template must be a safe file name');
  }

  return {
    template,
    secrets: input.secrets,
  };
}
