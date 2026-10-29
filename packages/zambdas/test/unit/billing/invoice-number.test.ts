import Oystehr from '@oystehr/sdk';
import { describe, expect, it, vi } from 'vitest';
import miscFhirResources from '../../../../../config/oystehr/miscFhirResources.json';
import { nextInvoiceNumber } from '../../../src/billing/invoice-number';
import {
  FHIR_COUNTER_CODE_SYSTEM,
  FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL,
  nextCounterValue,
} from '../../../src/shared/fhir-counter';

vi.mock('../../../src/shared/fhir-counter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/shared/fhir-counter')>()),
  nextCounterValue: vi.fn(),
}));

describe('invoice number counter seed', () => {
  it('is a counter for invoice numbers that starts before the first number', () => {
    expect(miscFhirResources.fhirResources.INVOICE_NUMBER_COUNTER.resource).toEqual({
      resourceType: 'Basic',
      code: {
        coding: [
          {
            system: FHIR_COUNTER_CODE_SYSTEM,
            code: 'invoice-number',
          },
        ],
      },
      extension: [
        {
          url: FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL,
          valueInteger: 0,
        },
      ],
    });
  });
});

describe('nextInvoiceNumber', () => {
  it('formats the next value of the invoice number counter', async () => {
    const oystehr = {} as Oystehr;
    vi.mocked(nextCounterValue).mockResolvedValueOnce(42);

    expect(await nextInvoiceNumber(oystehr)).toBe('INV-00042');
    expect(nextCounterValue).toHaveBeenCalledWith(oystehr, 'invoice-number');
  });
});
