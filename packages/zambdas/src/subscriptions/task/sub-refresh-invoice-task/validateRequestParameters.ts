import { Task } from 'fhir/r4b';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { parseInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import { InvoiceTaskInput, InvoiceTaskInputSchema } from 'utils/lib/types/api/invoicing.types';

export function validateRequestParameters(task: Task): {
  encounterId: string;
  invoiceTaskInput: InvoiceTaskInput;
} {
  const encounterId = getIdFromReference(task.encounter?.reference);
  if (!encounterId) throw new Error('Encounter id is not found');

  const invoiceTaskInput = parseInvoiceTaskInput(task);
  const subSendInvoiceInput = InvoiceTaskInputSchema.parse(invoiceTaskInput);

  return {
    encounterId,
    invoiceTaskInput: subSendInvoiceInput,
  };
}
