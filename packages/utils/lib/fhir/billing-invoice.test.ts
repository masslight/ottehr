import { PaymentNotice } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  buildBillingInvoice,
  BuildBillingInvoiceInput,
  formatInvoiceNumber,
  getBillingInvoiceClaims,
  getBillingInvoiceDueDate,
  getBillingInvoiceKind,
  getInvoiceNumber,
  getPaymentNoticeInvoiceId,
  getStripeInvoiceLink,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
  invoiceClaimTag,
  invoicePaymentExtension,
  invoiceStatusFromStripe,
  isInvoicePastDue,
  withStripeInvoiceLink,
} from './billing-invoice';

const base: Omit<BuildBillingInvoiceInput, 'claims' | 'recipient'> = {
  status: 'issued',
  date: '2026-10-25T12:00:00.000Z',
  dueDate: '2026-11-08',
  issuer: { reference: 'Organization/practice' },
};

describe('buildBillingInvoice', () => {
  it('builds a patient invoice for one claim', () => {
    const invoice = buildBillingInvoice({
      ...base,
      recipient: { reference: 'Patient/jane' },
      subject: { reference: 'Patient/jane' },
      claims: [{ claimId: 'claim-1', amountCents: 12345 }],
    });

    expect(invoice.subject).toEqual({ reference: 'Patient/jane' });
    expect(invoice.totalGross).toEqual({ value: 123.45, currency: 'USD' });
    expect(invoice.meta?.tag).toEqual([invoiceClaimTag('claim-1')]);
    expect(getBillingInvoiceClaims(invoice)).toEqual([{ claimId: 'claim-1', amountCents: 12345 }]);
    expect(getBillingInvoiceDueDate(invoice)).toBe('2026-11-08');
  });

  it('builds one NIO invoice for several claims without a subject', () => {
    const claims = [
      { claimId: 'claim-1', amountCents: 10000 },
      { claimId: 'claim-2', amountCents: 10000 },
      { claimId: 'claim-3', amountCents: 10000 },
    ];
    const invoice = buildBillingInvoice({ ...base, recipient: { reference: 'Organization/fedex' }, claims });

    expect(invoice.subject).toBeUndefined();
    expect(invoice.totalGross).toEqual({ value: 300, currency: 'USD' });
    expect(invoice.lineItem?.map((item) => item.sequence)).toEqual([1, 2, 3]);
    expect(invoice.meta?.tag).toEqual(claims.map((claim) => invoiceClaimTag(claim.claimId)));
    expect(getBillingInvoiceClaims(invoice)).toEqual(claims);
    expect(getStripeInvoiceLink(invoice)).toBeUndefined();
  });

  it('reads back cent amounts that are not exact in floating point', () => {
    const invoice = buildBillingInvoice({
      ...base,
      recipient: { reference: 'Patient/jane' },
      claims: [
        { claimId: 'claim-1', amountCents: 1999 },
        { claimId: 'claim-2', amountCents: 10 },
      ],
    });

    expect(getBillingInvoiceClaims(invoice).map((claim) => claim.amountCents)).toEqual([1999, 10]);
  });

  it('rejects an invoice without claims', () => {
    expect(() => buildBillingInvoice({ ...base, recipient: { reference: 'Patient/jane' }, claims: [] })).toThrow();
  });

  it.each([0.5, 0, -100])('rejects an amount of %s cents', (amountCents) => {
    expect(() =>
      buildBillingInvoice({
        ...base,
        recipient: { reference: 'Patient/jane' },
        claims: [{ claimId: 'c', amountCents }],
      })
    ).toThrow();
  });
});

describe('getBillingInvoiceClaims', () => {
  const invoice = buildBillingInvoice({
    ...base,
    recipient: { reference: 'Patient/jane' },
    claims: [{ claimId: 'claim-1', amountCents: 5000 }],
  });
  const line = invoice.lineItem![0];

  it.each([
    ['a missing amount value', { ...line, priceComponent: [{ type: 'base' as const, amount: { currency: 'USD' } }] }],
    ['a missing price', { ...line, priceComponent: undefined }],
    [
      'another currency',
      { ...line, priceComponent: [{ type: 'base' as const, amount: { value: 50, currency: 'EUR' } }] },
    ],
    ['no claim', { ...line, extension: undefined }],
  ])('rejects a line with %s', (_, badLine) => {
    expect(() => getBillingInvoiceClaims({ ...invoice, lineItem: [badLine] })).toThrow();
  });
});

describe('invoiceStatusFromStripe', () => {
  it.each([
    ['draft', 'draft'],
    ['open', 'issued'],
    ['paid', 'balanced'],
    ['void', 'cancelled'],
  ] as const)('maps %s to %s', (stripeStatus, status) => {
    expect(invoiceStatusFromStripe(stripeStatus)).toBe(status);
  });

  it('rejects uncollectible', () => {
    expect(() => invoiceStatusFromStripe('uncollectible')).toThrow();
  });
});

describe('isInvoicePastDue', () => {
  const invoice = buildBillingInvoice({
    ...base,
    recipient: {
      reference: 'Organization/fedex',
    },
    claims: [
      {
        claimId: 'claim-1',
        amountCents: 5000,
      },
    ],
  });

  it('is past due only after the due date', () => {
    expect(isInvoicePastDue(invoice, '2026-11-07')).toBe(false);
    expect(isInvoicePastDue(invoice, '2026-11-08')).toBe(false);
    expect(isInvoicePastDue(invoice, '2026-11-09')).toBe(true);
  });

  it.each(['draft', 'balanced', 'cancelled'] as const)('is never past due when %s', (status) => {
    expect(
      isInvoicePastDue(
        {
          ...invoice,
          status,
        },
        '2027-01-01'
      )
    ).toBe(false);
  });

  it('is not past due without a due date', () => {
    expect(
      isInvoicePastDue(
        {
          ...invoice,
          extension: undefined,
        },
        '2027-01-01'
      )
    ).toBe(false);
  });
});

describe('getBillingInvoiceKind', () => {
  const invoice = buildBillingInvoice({
    ...base,
    recipient: {
      reference: 'Organization/fedex',
    },
    claims: [
      {
        claimId: 'claim-1',
        amountCents: 5000,
      },
    ],
  });

  it.each([
    ['Organization/fedex', 'nio'],
    ['Patient/jane', 'patient'],
    ['RelatedPerson/guarantor', 'patient'],
  ] as const)('reads %s as %s', (reference, kind) => {
    expect(
      getBillingInvoiceKind({
        ...invoice,
        recipient: {
          reference,
        },
      })
    ).toBe(kind);
  });

  it.each([undefined, 'Practitioner/doc'])('rejects a %s recipient', (reference) => {
    expect(() =>
      getBillingInvoiceKind({
        ...invoice,
        recipient: {
          reference,
        },
      })
    ).toThrow();
  });
});

describe('formatInvoiceNumber', () => {
  it.each([
    [1, 'INV-00001'],
    [42, 'INV-00042'],
    [123456, 'INV-123456'],
  ])('formats %s as %s', (sequence, number) => {
    expect(formatInvoiceNumber(sequence)).toBe(number);
  });

  it.each([0, -1, 1.5])('rejects %s', (sequence) => {
    expect(() => formatInvoiceNumber(sequence)).toThrow();
  });

  it('is read back from the invoice identifier', () => {
    const invoice = buildBillingInvoice({
      ...base,
      recipient: {
        reference: 'Organization/fedex',
      },
      claims: [
        {
          claimId: 'claim-1',
          amountCents: 5000,
        },
      ],
    });

    expect(getInvoiceNumber(invoice)).toBeUndefined();
    expect(
      getInvoiceNumber({
        ...invoice,
        identifier: [
          {
            system: INVOICE_NUMBER_IDENTIFIER_SYSTEM,
            value: 'INV-00042',
          },
        ],
      })
    ).toBe('INV-00042');
  });
});

describe('getPaymentNoticeInvoiceId', () => {
  const notice: PaymentNotice = {
    resourceType: 'PaymentNotice',
    status: 'active',
    created: '2026-10-25T12:00:00.000Z',
    payment: {
      reference: '#contained-reconciliation',
    },
    recipient: {
      reference: 'Organization/practice',
    },
    amount: {
      value: 50,
      currency: 'USD',
    },
  };

  it('reads the invoice id from the invoice payment extension', () => {
    expect(
      getPaymentNoticeInvoiceId({
        ...notice,
        extension: [invoicePaymentExtension('invoice-1')],
      })
    ).toBe('invoice-1');
  });

  it('is undefined for a notice without an invoice', () => {
    expect(getPaymentNoticeInvoiceId(notice)).toBeUndefined();
  });
});

describe('withStripeInvoiceLink', () => {
  const invoice = buildBillingInvoice({
    ...base,
    recipient: { reference: 'Patient/jane' },
    claims: [{ claimId: 'claim-1', amountCents: 5000 }],
  });

  it('adds the Stripe invoice and keeps other fields', () => {
    const withOther = { ...invoice, identifier: [{ system: 'https://example.com/other', value: 'abc' }] };
    const linked = withStripeInvoiceLink(withOther, { stripeInvoiceId: 'in_1', stripeAccount: 'acct_1' });

    expect(linked.identifier).toHaveLength(2);
    expect(linked.identifier?.[0]).toEqual({ system: 'https://example.com/other', value: 'abc' });
    expect(linked.lineItem).toEqual(invoice.lineItem);
    expect(getStripeInvoiceLink(linked)).toEqual({ stripeInvoiceId: 'in_1', stripeAccount: 'acct_1' });
  });

  it('accepts the same link again but rejects a different one', () => {
    const linked = withStripeInvoiceLink(invoice, { stripeInvoiceId: 'in_1', stripeAccount: 'acct_1' });

    expect(withStripeInvoiceLink(linked, { stripeInvoiceId: 'in_1', stripeAccount: 'acct_1' })).toBe(linked);
    expect(() => withStripeInvoiceLink(linked, { stripeInvoiceId: 'in_2', stripeAccount: 'acct_1' })).toThrow();
    expect(() => withStripeInvoiceLink(linked, { stripeInvoiceId: 'in_1', stripeAccount: 'acct_2' })).toThrow();
  });
});
