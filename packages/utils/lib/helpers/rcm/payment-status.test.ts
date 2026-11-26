import { describe, expect, it } from 'vitest';
import { paymentStatusLabel } from './payment-status';

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

  it('labels a settled refund as refunded', () => {
    expect(
      paymentStatusLabel({
        status: 'active',
        amount: -20,
        outcome: 'complete',
      })
    ).toBe('Refunded');
    expect(
      paymentStatusLabel({
        status: 'active',
        amount: -20,
      })
    ).toBe('Refunded');
  });

  it('labels a refund that has not settled, or failed to, as pending', () => {
    expect(
      paymentStatusLabel({
        status: 'active',
        amount: -20,
        outcome: 'queued',
      })
    ).toBe('Refund pending');
    expect(
      paymentStatusLabel({
        status: 'active',
        amount: -20,
        outcome: 'error',
      })
    ).toBe('Refund pending');
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
