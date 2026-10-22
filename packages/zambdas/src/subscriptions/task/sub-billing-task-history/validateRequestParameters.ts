import { Task } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { TaskVersionSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../../shared/helpers';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

export interface Params {
  task: Task;
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): Params {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    task: safeValidate(TaskVersionSchema, validateJsonBody(input)),
    secrets: input.secrets,
  };
}
