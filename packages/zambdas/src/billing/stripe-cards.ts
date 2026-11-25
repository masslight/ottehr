import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { PatientStripeCustomer } from 'utils/lib/types/api/patient-payment-visits.types';
import { BillingCard } from 'utils/lib/types/data/billing/billing.types';

export const STRIPE_CARD_LIST_TIMEOUT_MS = 10_000;

export const listCustomerCards = async (
  stripeClient: Stripe,
  { customerId, stripeAccount }: PatientStripeCustomer
): Promise<BillingCard[]> => {
  const options = { stripeAccount };
  const [customer, paymentMethods] = await Promise.all([
    stripeClient.customers.retrieve(customerId, {}, options),
    stripeClient.customers.listPaymentMethods(customerId, { type: 'card', limit: 100 }, options),
  ]);
  if (customer.deleted) return [];

  const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;
  const defaultId = typeof defaultPaymentMethod === 'string' ? defaultPaymentMethod : defaultPaymentMethod?.id;
  const now = DateTime.now();

  return (
    paymentMethods.data
      .flatMap((paymentMethod): BillingCard[] =>
        paymentMethod.card
          ? [
              {
                id: paymentMethod.id,
                brand: paymentMethod.card.brand,
                lastFour: paymentMethod.card.last4,
                expMonth: paymentMethod.card.exp_month,
                expYear: paymentMethod.card.exp_year,
                default: paymentMethod.id === defaultId,
              },
            ]
          : []
      )
      // a card is good through the last day of its expiry month
      .filter((card) => DateTime.fromObject({ year: card.expYear, month: card.expMonth }).endOf('month') >= now)
      .sort((a, b) => Number(b.default) - Number(a.default))
  );
};
