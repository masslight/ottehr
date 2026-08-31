import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { parseInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import { InvoiceTaskInput, InvoiceTaskInputSchema } from 'utils/lib/types/api/invoicing.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): { task: Task; taskId: string; encounterId: string; invoiceTaskInput: InvoiceTaskInput } & Pick<
  ZambdaInput,
  'secrets'
> {
  if (!input.body) throw MISSING_REQUEST_BODY;

  const inputRes = safeJsonParse(input.body);

  if (inputRes.resourceType !== 'Task') {
    throw new Error(`resource parsed should be a Task but was a ${inputRes.resourceType}`);
  }

  const task = inputRes as Task;

  const taskId = task.id;
  if (!taskId) throw new Error('Task id is not found in the input task');

  const encounterId = task.encounter?.reference?.split('/')[1];
  if (!encounterId) throw new Error('Encounter id is not found');

  const invoiceTaskInput = parseInvoiceTaskInput(task);
  const subSendInvoiceInput = InvoiceTaskInputSchema.parse(invoiceTaskInput);

  const dueDate = subSendInvoiceInput.dueDate;
  if (dueDate && DateTime.fromISO(dueDate).toUnixInteger() < DateTime.now().toUnixInteger())
    throw new Error(
      `"dueDate" should be in the future. Due date provided: ${dueDate}, runtime time: ${DateTime.now().toISO()}`
    );

  return {
    task: task as Task,
    taskId,
    encounterId,
    invoiceTaskInput: subSendInvoiceInput,
    secrets: input.secrets,
  };
}
