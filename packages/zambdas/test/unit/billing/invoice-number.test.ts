import Oystehr from '@oystehr/sdk';
import { describe, expect, it, vi } from 'vitest';
import { nextInvoiceNumber } from '../../../src/billing/invoice-number';
import { nextCounterValue } from '../../../src/shared/fhir-counter';

vi.mock('../../../src/shared/fhir-counter', () => ({
  nextCounterValue: vi.fn(),
}));

describe('nextInvoiceNumber', () => {
  it('formats the next value of the invoice number counter', async () => {
    const oystehr = {} as Oystehr;
    vi.mocked(nextCounterValue).mockResolvedValueOnce(42);

    expect(await nextInvoiceNumber(oystehr)).toBe('INV-00042');
    expect(nextCounterValue).toHaveBeenCalledWith(oystehr, 'invoice-number');
  });
});
