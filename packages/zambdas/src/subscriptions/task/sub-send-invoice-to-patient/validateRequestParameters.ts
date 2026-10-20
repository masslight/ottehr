import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { parseInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import {
  SubSendInvoiceToPatientTaskInput,
  SubSendInvoiceToPatientTaskInputSchema,
} from 'utils/lib/types/api/invoicing.types';

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
