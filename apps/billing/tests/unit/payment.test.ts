import { describe, expect, it } from 'vitest';
import { paymentStatusLabel } from '../../src/constants/payment';

describe('paymentStatusLabel', () => {
  it('labels each payment status for billers', () => {
    expect(
      paymentStatusLabel({
        status: 'active',
        amount: 60,
      })
    ).toBe('Paid');
    expect(
      paymentStatusLabel({
        status: 'cancelled',
        amount: 60,
      })
    ).toBe('Cancelled');
    expect(
      paymentStatusLabel({
        status: 'draft',
        amount: 60,
      })
    ).toBe('Draft');
    expect(
      paymentStatusLabel({
        status: 'entered-in-error',
        amount: 60,
      })
    ).toBe('Entered in error');
  });

  it('labels a recorded refund as refunded', () => {
    expect(
      paymentStatusLabel({
        status: 'active',
        amount: -20,
      })
    ).toBe('Refunded');
  });

  it('shows a status it has no label for as is', () => {
    expect(
      paymentStatusLabel({
        status: 'unknown-status',
        amount: 60,
      })
    ).toBe('unknown-status');
  });
});
