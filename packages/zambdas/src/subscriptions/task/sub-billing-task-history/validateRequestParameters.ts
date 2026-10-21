import { Task } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../../shared/helpers';
import { ZambdaInput } from '../../../shared/types/common';

export interface Params {
  task: Task;
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): Params {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const task = validateJsonBody(input) as Task;
  if (task.resourceType !== 'Task' || !task.id || !task.meta?.versionId) {
    throw INVALID_INPUT_ERROR('Expected a Task with an id and a version');
  }
  return {
    task,
    secrets: input.secrets,
  };
}
