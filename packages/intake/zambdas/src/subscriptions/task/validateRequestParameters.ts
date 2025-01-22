import { ZambdaInput, TaskSubscriptionInput } from 'utils';
import { Task } from 'fhir/r4b';

// Note that this file is copied from BH and needs significant changes
export function validateRequestParameters(input: ZambdaInput): TaskSubscriptionInput {
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

  return {
    task: task as Task,
    secrets: input.secrets,
  };
}
