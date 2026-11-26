import { getPaymentNoticeInvoiceId, INVOICE_PAYMENT_TAG_SYSTEM } from 'utils/lib/fhir/billing-invoice';
import { describe, expect, it } from 'vitest';
import { buildPaymentNotice } from '../../../src/billing/payments';

const input = {
  request: {
    reference: 'Claim/claim-1',
  },
  payee: {
    reference: 'Organization/provider-1',
  },
  amountInCents: 18050,
  paymentMethod: 'check',
  identifier: {
    system: 'https://example.test/payment-id',
    value: 'payment-1',
  },
  paymentDate: '2026-11-19',
  createdISO: '2026-11-19T15:00:00.000Z',
  disposition: 'check payment collected manually',
};

describe('buildPaymentNotice', () => {
  it('builds an active notice for the claim with its contained reconciliation', () => {
    expect(buildPaymentNotice(input)).toEqual({
      resourceType: 'PaymentNotice',
      status: 'active',
      request: {
        reference: 'Claim/claim-1',
      },
      created: '2026-11-19T15:00:00.000Z',
      paymentDate: '2026-11-19',
      amount: {
        value: 180.5,
        currency: 'USD',
      },
      identifier: [
        {
          system: 'https://example.test/payment-id',
          value: 'payment-1',
        },
      ],
      extension: [
        {
          url: expect.any(String),
          valueString: 'check',
        },
      ],
      contained: [
        {
          resourceType: 'PaymentReconciliation',
          id: 'contained-reconciliation',
          status: 'active',
          created: '2026-11-19T15:00:00.000Z',
          disposition: 'check payment collected manually',
          outcome: 'complete',
          paymentDate: '2026-11-19',
          paymentAmount: {
            value: 180.5,
            currency: 'USD',
          },
        },
      ],
      payment: {
        reference: '#contained-reconciliation',
      },
      payee: {
        reference: 'Organization/provider-1',
      },
      recipient: {
        reference: 'Organization/provider-1',
      },
    });
  });

  it('tags and links a payment toward an invoice so the invoice both lists and counts it', () => {
    const notice = buildPaymentNotice({
      ...input,
      invoiceId: 'invoice-1',
    });

    expect(notice.meta?.tag).toEqual([
      {
        system: INVOICE_PAYMENT_TAG_SYSTEM,
        code: 'invoice-1',
      },
    ]);
    expect(getPaymentNoticeInvoiceId(notice)).toBe('invoice-1');
  });
});
