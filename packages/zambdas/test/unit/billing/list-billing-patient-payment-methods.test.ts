import Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { customerForScheduleOwner, listCustomerCards } from '../../../src/billing/list-billing-patient-payment-methods';

const card = (id: string, expYear: number, expMonth: number, last4 = '4242'): Stripe.PaymentMethod =>
  ({
    id,
    type: 'card',
    card: { brand: 'visa', last4, exp_month: expMonth, exp_year: expYear },
  }) as Stripe.PaymentMethod;

const stripeWith = (
  paymentMethods: Stripe.PaymentMethod[],
  customer: Partial<Stripe.Customer> | { deleted: true }
): { stripe: Stripe; retrieve: ReturnType<typeof vi.fn>; listPaymentMethods: ReturnType<typeof vi.fn> } => {
  const retrieve = vi.fn(async () => ({ id: 'cus_1', ...customer }));
  const listPaymentMethods = vi.fn(async () => ({ data: paymentMethods }));
  return { stripe: { customers: { retrieve, listPaymentMethods } } as unknown as Stripe, retrieve, listPaymentMethods };
};

describe('customerForScheduleOwner', () => {
  const customers = [
    { customerId: 'cus_platform', stripeAccount: undefined },
    { customerId: 'cus_connected', stripeAccount: 'acct_1' },
  ];

  it('picks the customer on the account the visit takes payments on', () => {
    expect(customerForScheduleOwner(customers, { stripeAccount: 'acct_1' })?.customerId).toBe('cus_connected');
    expect(customerForScheduleOwner(customers, {})?.customerId).toBe('cus_platform');
  });

  it('finds none when the patient has no customer on that account', () => {
    expect(customerForScheduleOwner(customers, { stripeAccount: 'acct_2' })).toBeUndefined();
  });

  it('finds none for a visit without a schedule owner, rather than the platform customer', () => {
    expect(customerForScheduleOwner(customers, undefined)).toBeUndefined();
  });
});

describe('listCustomerCards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists unexpired cards with the default first, on the customer’s account', async () => {
    const { stripe, retrieve, listPaymentMethods } = stripeWith(
      [
        card('pm_other', 2027, 1, '1111'),
        card('pm_expired', 2026, 10),
        // expires this month, so still usable
        card('pm_default', 2026, 11, '2222'),
      ],
      { invoice_settings: { default_payment_method: 'pm_default' } } as Partial<Stripe.Customer>
    );

    const cards = await listCustomerCards(stripe, { customerId: 'cus_1', stripeAccount: 'acct_1' });

    expect(cards).toEqual([
      { id: 'pm_default', brand: 'visa', lastFour: '2222', expMonth: 11, expYear: 2026, default: true },
      { id: 'pm_other', brand: 'visa', lastFour: '1111', expMonth: 1, expYear: 2027, default: false },
    ]);
    expect(retrieve).toHaveBeenCalledWith('cus_1', {}, { stripeAccount: 'acct_1' });
    expect(listPaymentMethods).toHaveBeenCalledWith('cus_1', { type: 'card', limit: 100 }, { stripeAccount: 'acct_1' });
  });

  it('lists nothing for a deleted customer', async () => {
    const { stripe } = stripeWith([card('pm_1', 2030, 1)], { deleted: true });

    expect(await listCustomerCards(stripe, { customerId: 'cus_1' })).toEqual([]);
  });
});
