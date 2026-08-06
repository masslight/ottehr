import { Task } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export interface TaskSubscriptionInput {
  task: Task;
  secrets: Secrets;
}

const TaskBodySchema = z
  .object({
    resourceType: z.literal('Task'),
    status: z.string(),
  })
  .passthrough()
  .refine((t) => t.status !== 'completed', { message: 'task is already completed', path: ['status'] })
  .refine((t) => t.status !== 'failed', { message: 'task has already failed', path: ['status'] });

export function validateRequestParameters(input: ZambdaInput): TaskSubscriptionInput & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const task = safeValidate(TaskBodySchema, safeJsonParse(input.body)) as unknown as Task;

  return {
    task,
    secrets: input.secrets,
  };
}
