import { Task } from 'fhir/r4b';
import { InvoiceTaskInput, InvoiceTaskInputSchema, MISSING_REQUEST_BODY, parseInvoiceTaskInput } from 'utils';
import { ZambdaInput } from '../../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): { task: Task; taskId: string; encounterId: string; invoiceTaskInput: InvoiceTaskInput } & Pick<
  ZambdaInput,
  'secrets'
> {
  if (!input.body) throw MISSING_REQUEST_BODY;

  const inputRes = JSON.parse(input.body);

  if (inputRes.resourceType !== 'Task') {
    throw new Error(`resource parsed should be a Task but was a ${inputRes.resourceType}`);
  }

  const task = inputRes as Task;

  const invoiceTaskInput = parseInvoiceTaskInput(task);
  const subSendInvoiceInput = InvoiceTaskInputSchema.parse(invoiceTaskInput);

  const encounterId = task.encounter?.reference?.split('/')[1];
  if (!encounterId) throw new Error('Encounter id is not found');

  const taskId = task.id;
  if (!taskId) throw new Error('Task id is not found in the input task');

  return {
    task: task as Task,
    taskId,
    encounterId,
    invoiceTaskInput: subSendInvoiceInput,
    secrets: input.secrets,
  };
}
