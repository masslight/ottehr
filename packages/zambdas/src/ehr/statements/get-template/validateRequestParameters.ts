import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface GetStatementTemplateInput {
  template: string;
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): GetStatementTemplateInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const body = JSON.parse(input.body) as Record<string, unknown>;

  const template = body.template;
  if (typeof template !== 'string' || template.length === 0) {
    throw new Error('template is required');
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(template)) {
    throw new Error('template must be a safe file name');
  }

  return {
    template,
    secrets: input.secrets,
  };
}
