import { Task, TaskInput } from 'fhir/r4b';
import { ottehrCodeSystemUrl } from '../../fhir/systemUrls';
import { PrefilledInvoiceInfo } from '../../types';

export function createInvoiceTaskInput(input: PrefilledInvoiceInfo): TaskInput[] {
  const fieldsNames = Object.keys(input);

  return fieldsNames.map((fieldName) => {
    let fieldValue = input[fieldName as keyof PrefilledInvoiceInfo];
    if (typeof fieldValue === 'number') fieldValue = fieldValue.toString();
    return {
      type: {
        coding: [
          {
            system: ottehrCodeSystemUrl('invoice-task-input'),
            code: fieldName,
          },
        ],
      },
      valueString: fieldValue,
    };
  });
}

export function parseInvoiceTaskInput(invoiceTask: Task): PrefilledInvoiceInfo {
  const dueDate = getInvoiceTaskInputFieldByCode('dueDate', invoiceTask);
  const memo = getInvoiceTaskInputFieldByCode('memo', invoiceTask);
  const smsTextMessage = getInvoiceTaskInputFieldByCode('smsTextMessage', invoiceTask);
  const amount = getInvoiceTaskInputFieldByCode('amountCents', invoiceTask);
  if (!dueDate || !smsTextMessage || !amount)
    throw new Error('Missing invoice task input fields dueDate, smsTextMessage, or amountCents');
  if (isNaN(parseInt(amount))) throw new Error('Invalid amountCents value');
  return {
    dueDate,
    memo,
    smsTextMessage,
    amountCents: parseInt(amount),
  };
}

function getInvoiceTaskInputFieldByCode(code: keyof PrefilledInvoiceInfo, task: Task): string | undefined {
  return task.input?.find(
    (input) =>
      input.type.coding?.find((type) => type.system === ottehrCodeSystemUrl('invoice-task-input') && type.code === code)
  )?.valueString;
}
