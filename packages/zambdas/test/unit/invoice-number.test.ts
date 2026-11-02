import Oystehr from '@oystehr/sdk';
import { describe, expect, it, vi } from 'vitest';
import { nextInvoiceNumber } from '../../src/shared/invoice-number';

describe('nextInvoiceNumber', () => {
  it('takes the number billing issues', async () => {
    const execute = vi.fn().mockResolvedValue({
      output: {
        invoiceNumber: 'INV-00042',
      },
    });
    const oystehr = {
      zambda: {
        execute,
      },
    } as unknown as Oystehr;

    expect(await nextInvoiceNumber(oystehr)).toBe('INV-00042');
    expect(execute).toHaveBeenCalledWith({
      id: 'issue-billing-invoice-number',
    });
  });
});
