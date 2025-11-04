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
  return {
    recipientName: 'temp',
    recipientEmail: 'temp',
    recipientPhoneNumber: '123',
    dueDate: '2041-10-05T14:48:00.000Z',
    memo: 'temp',
    smsTextMessage: 'temp',
  };
}
