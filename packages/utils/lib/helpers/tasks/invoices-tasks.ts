import { Task, TaskInput } from 'fhir/r4b';
import { RcmTaskCode } from '../../fhir';
import { ottehrCodeSystemUrl } from '../../fhir/systemUrls';
import {
  INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
  INVOICE_TASK_SOURCE_SYSTEM,
  InvoiceTaskDisplayStatus,
  InvoiceTaskInput,
  InvoiceTaskInputSchema,
  InvoiceTaskSource,
} from '../../types';

export function createInvoiceTaskInput(input: InvoiceTaskInput): TaskInput[] {
  const fieldsNames = Object.keys(input);

  return fieldsNames.map((fieldName) => {
    let fieldValue = input[fieldName as keyof InvoiceTaskInput];
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

export function parseInvoiceTaskInput(invoiceTask: Task): InvoiceTaskInput {
  const dueDate = getInvoiceTaskInputFieldByCode('dueDate', invoiceTask);
  const memo = getInvoiceTaskInputFieldByCode('memo', invoiceTask);
  const smsTextMessage = getInvoiceTaskInputFieldByCode('smsTextMessage', invoiceTask);
  const amount = getInvoiceTaskInputFieldByCode('amountCents', invoiceTask);
  const claimId = getInvoiceTaskInputFieldByCode('claimId', invoiceTask);
  const finalizationDate = getInvoiceTaskInputFieldByCode('finalizationDate', invoiceTask);

  const taskInput: InvoiceTaskInput = {
    dueDate,
    memo,
    smsTextMessage,
    claimId,
    finalizationDate,
    amountCents: parseInt(amount ?? '0'),
  };
  return InvoiceTaskInputSchema.parse(taskInput);
}

function getInvoiceTaskInputFieldByCode(code: keyof InvoiceTaskInput, task: Task): string | undefined {
  return task.input?.find(
    (input) =>
      input.type.coding?.find((type) => type.system === ottehrCodeSystemUrl('invoice-task-input') && type.code === code)
  )?.valueString;
}

export function getInvoiceTaskSource(task: Pick<Task, 'meta'>): InvoiceTaskSource {
  const code = task.meta?.tag?.find((tag) => tag.system === INVOICE_TASK_SOURCE_SYSTEM)?.code;
  return code === 'ottehr-billing' ? 'ottehr-billing' : 'candid';
}

export function getInvoiceTaskClaimId(task: Pick<Task, 'identifier'>): string | undefined {
  return task.identifier?.find((identifier) => identifier.system === INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM)?.value;
}

export function invoiceTaskSourceSearchParam(
  source: InvoiceTaskSource | undefined
): { name: string; value: string } | undefined {
  if (!source) return undefined;
  return {
    name: source === 'candid' ? '_tag:not' : '_tag',
    value: `${INVOICE_TASK_SOURCE_SYSTEM}|ottehr-billing`,
  };
}

export function mapInvoiceTaskStatusToDisplay(status: Task['status']): InvoiceTaskDisplayStatus {
  switch (status) {
    case 'ready':
      return 'ready';
    case 'requested':
      return 'updating';
    case 'in-progress':
      return 'sending';
    case 'completed':
      return 'sent';
    default:
      return 'error';
  }
}

export function mapDisplayToInvoiceTaskStatus(status: InvoiceTaskDisplayStatus): Task['status'] {
  switch (status) {
    case 'ready':
      return 'ready';
    case 'updating':
      return 'requested';
    case 'sending':
      return 'in-progress';
    case 'sent':
      return 'completed';
    case 'error':
      return 'failed';
    default:
      return 'failed';
  }
}

export function getLatestTaskOutput(task: Task): { type: 'error' | 'success'; message?: string } | undefined {
  const lastTaskOutput = task.output?.at(-1);
  if (lastTaskOutput?.type?.coding?.find((coding) => coding.code === RcmTaskCode.sendInvoiceOutputInvoiceId)) {
    return { type: 'success', message: lastTaskOutput.valueString };
  } else if (lastTaskOutput?.type?.coding?.find((coding) => coding.code === RcmTaskCode.sendInvoiceOutputError)) {
    return { type: 'error', message: lastTaskOutput.valueString };
  }
  return undefined;
}
