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

export function parseInvoiceTaskInput(invoiceTask: Task): PrefilledInvoiceInfo | undefined {
  const patientFullName = getInvoiceTaskInputFieldByCode('patientFullName', invoiceTask);
  const patientDob = getInvoiceTaskInputFieldByCode('patientDob', invoiceTask);
  const patientGender = getInvoiceTaskInputFieldByCode('patientGender', invoiceTask);
  const patientPhoneNumber = getInvoiceTaskInputFieldByCode('patientPhoneNumber', invoiceTask);
  const responsiblePartyName = getInvoiceTaskInputFieldByCode('responsiblePartyName', invoiceTask);
  const responsiblePartyPhoneNumber = getInvoiceTaskInputFieldByCode('responsiblePartyPhoneNumber', invoiceTask);
  const responsiblePartyEmail = getInvoiceTaskInputFieldByCode('responsiblePartyEmail', invoiceTask);
  const dueDate = getInvoiceTaskInputFieldByCode('dueDate', invoiceTask);
  const memo = getInvoiceTaskInputFieldByCode('memo', invoiceTask);
  const smsTextMessage = getInvoiceTaskInputFieldByCode('smsTextMessage', invoiceTask);
  const amount = getInvoiceTaskInputFieldByCode('amountCents', invoiceTask);
  if (
    !patientFullName ||
    !patientDob ||
    !patientGender ||
    !patientPhoneNumber ||
    !responsiblePartyName ||
    !responsiblePartyPhoneNumber ||
    !dueDate ||
    !smsTextMessage ||
    !amount
  )
    return undefined;
  return {
    patientFullName,
    patientDob,
    patientGender,
    patientPhoneNumber,
    responsiblePartyName,
    responsiblePartyEmail,
    responsiblePartyPhoneNumber,
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
