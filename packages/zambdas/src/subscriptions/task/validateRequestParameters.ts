import { Task } from 'fhir/r4b';
import { Secrets } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

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
    throw new Error('No request body provided');
  }

  const task = safeValidate(TaskBodySchema, JSON.parse(input.body)) as unknown as Task;

  if (!input.secrets) {
    throw new Error('Secrets not sent with input.');
  }

  return {
    task,
    secrets: input.secrets,
  };
}
