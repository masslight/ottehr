import { Task } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
  INVOICE_TASK_SOURCE_SYSTEM,
  invoiceTaskSourceTag,
} from '../../types/api/invoicing.types';
import {
  createInvoiceTaskInput,
  getInvoiceTaskClaimId,
  getInvoiceTaskOutputs,
  getInvoiceTaskSource,
  invoiceTaskSourceSearchParam,
  parseInvoiceTaskInput,
} from './invoices-tasks';

const task = (overrides: Partial<Task> = {}): Task => ({
  resourceType: 'Task',
  status: 'ready',
  intent: 'order',
  ...overrides,
});

describe('getInvoiceTaskSource', () => {
  it('returns ottehr-billing for tasks tagged by the billing producer', () => {
    const tagged = task({
      meta: {
        tag: [invoiceTaskSourceTag('ottehr-billing')],
      },
    });
    expect(getInvoiceTaskSource(tagged)).toBe('ottehr-billing');
  });

  it('returns candid for tasks tagged candid', () => {
    const tagged = task({
      meta: {
        tag: [invoiceTaskSourceTag('candid')],
      },
    });
    expect(getInvoiceTaskSource(tagged)).toBe('candid');
  });

  it('returns candid for legacy untagged tasks', () => {
    expect(getInvoiceTaskSource(task())).toBe('candid');
    expect(getInvoiceTaskSource(task({ meta: {} }))).toBe('candid');
  });

  it('ignores tags from other systems, even with a matching code', () => {
    const foreign = task({
      meta: {
        tag: [
          {
            system: 'https://example.com/other-system',
            code: 'ottehr-billing',
          },
        ],
      },
    });
    expect(getInvoiceTaskSource(foreign)).toBe('candid');
  });
});

describe('getInvoiceTaskClaimId', () => {
  it('returns the claim id identifier value', () => {
    const withIdentifier = task({
      identifier: [
        {
          system: INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
          value: 'claim-1',
        },
      ],
    });
    expect(getInvoiceTaskClaimId(withIdentifier)).toBe('claim-1');
  });

  it('returns undefined without the identifier', () => {
    expect(getInvoiceTaskClaimId(task())).toBeUndefined();
    const foreign = task({
      identifier: [
        {
          system: 'https://example.com/other-system',
          value: 'claim-1',
        },
      ],
    });
    expect(getInvoiceTaskClaimId(foreign)).toBeUndefined();
  });
});

describe('source tag shape', () => {
  it('builds a coding under the invoice-task-source system', () => {
    expect(invoiceTaskSourceTag('ottehr-billing')).toEqual({
      system: INVOICE_TASK_SOURCE_SYSTEM,
      code: 'ottehr-billing',
    });
  });
});

const invoiceIdOutput = (valueString: string): NonNullable<Task['output']>[number] => ({
  type: { coding: [{ code: 'send-invoice-output-invoice-Id' }] },
  valueString,
});

const errorOutput = (valueString: string): NonNullable<Task['output']>[number] => ({
  type: { coding: [{ code: 'send-invoice-output-error' }] },
  valueString,
});

const unrelatedOutput = (): NonNullable<Task['output']>[number] => ({
  type: { coding: [{ code: 'some-other-output-code' }] },
  valueString: 'ignored',
});

describe('getInvoiceTaskOutputs', () => {
  it('returns empty object when the task has no output array', () => {
    expect(getInvoiceTaskOutputs(task())).toEqual({});
  });

  it('returns empty object when outputs carry unrecognised codes only', () => {
    expect(getInvoiceTaskOutputs(task({ output: [unrelatedOutput(), unrelatedOutput()] }))).toEqual({});
  });

  it('extracts a single invoice ID', () => {
    expect(getInvoiceTaskOutputs(task({ output: [invoiceIdOutput('in_abc')] }))).toEqual({ invoiceId: 'in_abc' });
  });

  it('extracts a single error', () => {
    expect(getInvoiceTaskOutputs(task({ output: [errorOutput('Stripe error')] }))).toEqual({
      error: 'Stripe error',
    });
  });

  it('picks the latest invoice ID when multiple are present', () => {
    const result = getInvoiceTaskOutputs(
      task({ output: [invoiceIdOutput('in_first'), invoiceIdOutput('in_second'), invoiceIdOutput('in_latest')] })
    );
    expect(result.invoiceId).toBe('in_latest');
  });

  it('picks the latest error when multiple are present', () => {
    const result = getInvoiceTaskOutputs(
      task({ output: [errorOutput('err_first'), errorOutput('err_second'), errorOutput('err_latest')] })
    );
    expect(result.error).toBe('err_latest');
  });

  it('returns both when invoice ID output precedes an error output', () => {
    // typical failed-after-send sequence
    const result = getInvoiceTaskOutputs(task({ output: [invoiceIdOutput('in_sent'), errorOutput('retry failed')] }));
    expect(result).toEqual({ invoiceId: 'in_sent', error: 'retry failed' });
  });

  it('returns both when outputs are interleaved with unrelated entries', () => {
    const result = getInvoiceTaskOutputs(
      task({
        output: [
          unrelatedOutput(),
          invoiceIdOutput('in_early'),
          unrelatedOutput(),
          errorOutput('bad email'),
          unrelatedOutput(),
        ],
      })
    );
    expect(result).toEqual({ invoiceId: 'in_early', error: 'bad email' });
  });

  it('picks the latest of each type independently when both appear multiple times', () => {
    const result = getInvoiceTaskOutputs(
      task({
        output: [
          invoiceIdOutput('in_first'),
          errorOutput('err_first'),
          invoiceIdOutput('in_second'),
          errorOutput('err_second'),
        ],
      })
    );
    expect(result).toEqual({ invoiceId: 'in_second', error: 'err_second' });
  });
});

describe('invoiceTaskSourceSearchParam', () => {
  it('selects tagged tasks for the billing screen', () => {
    expect(invoiceTaskSourceSearchParam('ottehr-billing')).toEqual({
      name: '_tag',
      value: `${INVOICE_TASK_SOURCE_SYSTEM}|ottehr-billing`,
    });
  });

  it('excludes tagged tasks for the candid screen, keeping legacy untagged tasks visible', () => {
    expect(invoiceTaskSourceSearchParam('candid')).toEqual({
      name: '_tag:not',
      value: `${INVOICE_TASK_SOURCE_SYSTEM}|ottehr-billing`,
    });
  });

  it('returns undefined when no source filter is given', () => {
    expect(invoiceTaskSourceSearchParam(undefined)).toBeUndefined();
  });
});

describe('createInvoiceTaskInput', () => {
  const codes = (inputs: ReturnType<typeof createInvoiceTaskInput>): (string | undefined)[] =>
    inputs.map((input) => input.type.coding?.[0]?.code);

  it('writes every populated field as a valueString, including a zero amount', () => {
    const inputs = createInvoiceTaskInput({
      dueDate: '2030-01-31',
      memo: ' Thanks for visiting ',
      smsTextMessage: 'Pay here',
      amountCents: 0,
      claimId: 'claim-1',
    });

    expect(codes(inputs)).toEqual(['dueDate', 'memo', 'smsTextMessage', 'amountCents', 'claimId']);
    expect(inputs.find((input) => input.type.coding?.[0]?.code === 'memo')?.valueString).toBe(' Thanks for visiting ');
    expect(inputs.find((input) => input.type.coding?.[0]?.code === 'amountCents')?.valueString).toBe('0');
  });

  it('skips blank and undefined fields so no input is written without a value', () => {
    const inputs = createInvoiceTaskInput({
      dueDate: '2030-01-31',
      memo: '   ',
      smsTextMessage: '\n',
      amountCents: 500,
      claimId: undefined,
      finalizationDate: '',
    });

    expect(codes(inputs)).toEqual(['dueDate', 'amountCents']);
    expect(inputs.every((input) => input.valueString?.trim())).toBe(true);
  });

  it('round-trips a legacy task missing claimId and finalizationDate without valueless inputs', () => {
    const legacy = task({ input: createInvoiceTaskInput({ dueDate: '2030-01-31', memo: 'm', smsTextMessage: 's' }) });

    const rebuilt = createInvoiceTaskInput({ ...parseInvoiceTaskInput(legacy), memo: 'new memo' });

    expect(codes(rebuilt)).toEqual(['dueDate', 'memo', 'smsTextMessage', 'amountCents']);
    expect(rebuilt.every((input) => input.valueString !== undefined)).toBe(true);
  });
});
