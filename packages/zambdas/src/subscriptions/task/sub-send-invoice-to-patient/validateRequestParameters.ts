import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { parseInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import {
  SubSendInvoiceToPatientTaskInput,
  SubSendInvoiceToPatientTaskInputSchema,
} from 'utils/lib/types/api/invoicing.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

export function validateRequestParameters(task: Task): {
  encounterId: string;
  invoiceTaskInput: SubSendInvoiceToPatientTaskInput;
} {
  const encounterId = task.encounter?.reference?.split('/')[1];
  if (!encounterId) throw new Error('Encounter id is not found');

  const invoiceTaskInput = parseInvoiceTaskInput(task);
  const invoiceTaskInputParsed = SubSendInvoiceToPatientTaskInputSchema.parse(invoiceTaskInput);

  const dueDate = invoiceTaskInputParsed.dueDate;
  if (DateTime.fromISO(dueDate).toUnixInteger() < DateTime.now().toUnixInteger())
    throw new Error('Due date should be in the future');

  return {
    encounterId,
    invoiceTaskInput: invoiceTaskInputParsed,
  };
}

export function getTaskAndSecretsFromInput(input: ZambdaInput): { task: Task } & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;

  const inputRes = safeJsonParse(input.body);

  if (inputRes.resourceType !== 'Task') {
    throw new Error(`resource parsed should be a Task but was a ${inputRes.resourceType}`);
  }

  const task = inputRes as Task;
  return {
    task,
    secrets: input.secrets,
  };
}
