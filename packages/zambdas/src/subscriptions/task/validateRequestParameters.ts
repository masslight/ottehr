import { Task } from 'fhir/r4b';
import { Secrets, TaskSubscriptionInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): TaskSubscriptionInput & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const task = JSON.parse(input.body);

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
    task: task as Task,
    secrets: input.secrets,
  };
}
