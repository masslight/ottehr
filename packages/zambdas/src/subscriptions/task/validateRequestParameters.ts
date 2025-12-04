import { Task } from 'fhir/r4b';
import { Secrets } from 'utils';
import z from 'zod';
import { ZambdaInput } from '../../shared';

const taskSubscriptionSchema = z.object({
  task: z.object({}).passthrough(),
  secrets: z.record(z.string(), z.string()).nullable(),
});

export type TaskSubscriptionInput = { task: Task; secrets: Secrets };

export function validateRequestParameters(input: ZambdaInput): TaskSubscriptionInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const data = JSON.parse(input.body);
  const parsedData = taskSubscriptionSchema.safeParse(data);
  if (!parsedData.success) {
    throw new Error(`Invalid task subscription input: ${JSON.stringify(parsedData.error.issues)}`);
  }

  const task = parsedData.data.task as unknown as Task;

  if (task.resourceType !== 'Task') {
    throw new Error(`resource parsed should be a task but was a ${task.resourceType}`);
  }

  if (task.status === 'completed') {
    throw new Error(`task is already completed`);
  }

  if (task.status === 'failed') {
    throw new Error(`task has already failed`);
  }

  if (!input.secrets) {
    throw new Error('Secrets not sent with input.');
  }

  return {
    task,
    secrets: input.secrets,
  };
}
