import { Task, TaskInput } from 'fhir/r4b';
import { ottehrCodeSystemUrl } from '../../fhir/systemUrls';
import { PrefilledInvoiceInfo } from '../../types';

export function createInvoiceTaskInput(input: PrefilledInvoiceInfo): TaskInput[] {
  const fieldsNames = Object.keys(input);

  return fieldsNames.map((fieldName) => {
    return {
      type: {
        coding: [
          {
            system: ottehrCodeSystemUrl('invoice-task-input'),
            code: fieldName,
          },
        ],
      },
      valueString: input[fieldName as keyof PrefilledInvoiceInfo],
    };
  });
}

export function parseInvoiceTaskInput(invoiceTask: Task): PrefilledInvoiceInfo | undefined {
  console.log('invoiceTask', invoiceTask);
  const recipientName = getInvoiceTaskInputFieldByCode('recipientName', invoiceTask);
  const recipientEmail = getInvoiceTaskInputFieldByCode('recipientEmail', invoiceTask);
  const recipientPhoneNumber = getInvoiceTaskInputFieldByCode('recipientPhoneNumber', invoiceTask);
  const dueDate = getInvoiceTaskInputFieldByCode('dueDate', invoiceTask);
  const memo = getInvoiceTaskInputFieldByCode('memo', invoiceTask);
  const smsTextMessage = getInvoiceTaskInputFieldByCode('smsTextMessage', invoiceTask);
  if (!recipientName || !recipientEmail || !recipientPhoneNumber || !dueDate || !smsTextMessage) return undefined;
  return {
    recipientName,
    recipientEmail,
    recipientPhoneNumber,
    dueDate,
    memo,
    smsTextMessage,
  };
}

function getInvoiceTaskInputFieldByCode(code: string, task: Task): string | undefined {
  return task.input?.find(
    (input) =>
      input.type.coding?.find((type) => type.system === ottehrCodeSystemUrl('invoice-task-input') && type.code === code)
  )?.valueString;
}
