import Oystehr from '@oystehr/sdk';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';
import billingZambdasSpec from '../../../../../config/billing-app-core/zambdas.json';
import { INVOICE_NUMBER_COUNTER_KEY, performEffect } from '../../../src/billing/issue-billing-invoice-number/index';
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
  it('is a billing counter for invoice numbers that starts before the first number', () => {
    expect(billingZambdasSpec.fhirResources.INVOICE_NUMBER_COUNTER.resource).toEqual({
      resourceType: 'Basic',
      meta: {
        tag: [BILLING_RESOURCE_TAG],
      },
      code: {
        coding: [
          {
            system: FHIR_COUNTER_CODE_SYSTEM,
            code: INVOICE_NUMBER_COUNTER_KEY,
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

describe('issue-billing-invoice-number', () => {
  it('formats the next value of the invoice number counter', async () => {
    const oystehr = {} as Oystehr;
    vi.mocked(nextCounterValue).mockResolvedValueOnce(42);

    expect(await performEffect(oystehr)).toEqual({
      invoiceNumber: 'INV-00042',
    });
    expect(nextCounterValue).toHaveBeenCalledWith(oystehr, 'invoice-number');
  });
});
