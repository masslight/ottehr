import { Task } from 'fhir/r4b';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import {
  SubSendInvoiceToPatientTaskInput,
  SubSendInvoiceToPatientTaskInputSchema,
} from 'utils/lib/types/api/invoicing.types';
import { parseInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): { task: Task; encounterId: string; invoiceTaskInput: SubSendInvoiceToPatientTaskInput } & Pick<
  ZambdaInput,
  'secrets'
> {
  if (!input.body) throw MISSING_REQUEST_BODY;

  const inputRes = safeJsonParse(input.body);

  if (inputRes.resourceType !== 'Task') {
    throw new Error(`resource parsed should be a Task but was a ${inputRes.resourceType}`);
  }

  const task = inputRes as Task;

  const invoiceTaskInput = parseInvoiceTaskInput(task);
  const invoiceTaskInputParsed = SubSendInvoiceToPatientTaskInputSchema.parse(invoiceTaskInput);

  const encounterId = task.encounter?.reference?.split('/')[1];
  if (!encounterId) throw new Error('Encounter id is not found');

  return {
    task: task as Task,
    encounterId,
    invoiceTaskInput: invoiceTaskInputParsed,
    secrets: input.secrets,
  };
}
