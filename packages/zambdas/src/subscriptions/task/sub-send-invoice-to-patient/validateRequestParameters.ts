import { Task } from 'fhir/r4b';
import { parseInvoiceTaskInput, PrefilledInvoiceInfo } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): { task: Task; encounterId: string; prefilledInfo: PrefilledInvoiceInfo } & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const inputRes = JSON.parse(input.body);

  if (inputRes.resourceType !== 'Task') {
    throw new Error(`resource parsed should be a Task but was a ${inputRes.resourceType}`);
  }

  const task = inputRes as Task;

  const prefilledInfo = parseInvoiceTaskInput(task);
  if (!prefilledInfo) throw new Error('Prefilled info is not found');

  const encounterId = task.encounter?.reference?.split('/')[1];
  if (!encounterId) throw new Error('Encounter id is not found');

  return {
    task: task as Task,
    encounterId,
    prefilledInfo,
    secrets: input.secrets,
  };
}
