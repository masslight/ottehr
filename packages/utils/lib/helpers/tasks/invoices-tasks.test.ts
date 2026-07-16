import { Task } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM, INVOICE_TASK_SOURCE_SYSTEM, invoiceTaskSourceTag } from '../../types';
import { getInvoiceTaskClaimId, getInvoiceTaskSource, invoiceTaskSourceSearchParam } from './invoices-tasks';

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
