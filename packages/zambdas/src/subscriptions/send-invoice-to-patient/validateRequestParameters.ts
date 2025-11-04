import { Task } from 'fhir/r4b';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): { task: Task } & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const task = JSON.parse(input.body);

  if (task.resourceType !== 'Task') {
    throw new Error(`resource parsed should be a Task but was a ${task.resourceType}`);
  }

  return {
    task: task as Task,
    secrets: input.secrets,
  };
}
