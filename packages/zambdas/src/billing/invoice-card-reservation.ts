import Oystehr from '@oystehr/sdk';
import { Invoice, ProvenanceAgent } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { getInvoiceCardPaymentReservation, InvoiceCardPaymentReservation } from 'utils/lib/fhir/billing-invoice';
import {
  getStripeCustomerIdFromAccount,
  patchWithOptimisticLock,
  withVersionConflictRetries,
} from 'utils/lib/fhir/helpers';
import { Secrets } from 'utils/lib/secrets';
import { STRIPE_METADATA_KEYS } from '../shared/stripeIntegration';
import {
  cardPaymentInProgressError,
  cardPaymentReservationOperations,
  readPayableInvoice,
  recordInvoiceCardPayment,
} from './invoice-payments';
import { resolveInvoiceStripePayer } from './invoice-stripe';
import { fetchById } from './shared';

// A reserving request creates its PaymentIntent within seconds; until then Stripe has nothing to show.
export const CARD_RESERVATION_GRACE_MINUTES = 2;

const CHARGING_STATUSES: Stripe.PaymentIntent.Status[] = [
  'processing',
  'requires_action',
  'requires_capture',
  'requires_confirmation',
];

// Settles a card payment another request reserved on the invoice: records it when its charge went
// through, refuses while it may still be charging, and releases it when it never charged.
export async function settleOtherCardReservation({
  oystehr,
  getStripe,
  invoiceId,
  paymentId,
  agent,
  secrets,
  now = DateTime.now(),
}: {
  oystehr: Oystehr;
  // only called when another payment holds a reservation
  getStripe: () => Stripe;
  invoiceId: string;
  paymentId: string;
  agent: ProvenanceAgent;
  secrets: Secrets | null;
  now?: DateTime;
}): Promise<void> {
  const invoice = await fetchById<Invoice>(oystehr, 'Invoice', invoiceId);
  const reservation = getInvoiceCardPaymentReservation(invoice);
  if (!reservation || reservation.paymentId === paymentId) return;

  const { stripeAccount, nio } = await resolveInvoiceStripePayer({
    oystehr,
    invoice,
  });
  const customerId = getStripeCustomerIdFromAccount(nio, stripeAccount);
  const reservedAt = DateTime.fromISO(reservation.reservedAt);
  const paymentIntent = customerId
    ? await findPaymentIntentForPayment({
        stripe: getStripe(),
        stripeAccount,
        customerId,
        createdFrom: reservedAt.minus({ minutes: 1 }),
        invoiceId,
        paymentId: reservation.paymentId,
      })
    : undefined;

  if (paymentIntent?.status === 'succeeded') {
    await recordInvoiceCardPayment({
      oystehr,
      invoiceId,
      paymentId: reservation.paymentId,
      amountInCents: paymentIntent.amount,
      chargedAt: DateTime.fromSeconds(paymentIntent.created),
      stripePaymentId: paymentIntent.id,
      stripeAccount,
      agent,
      secrets,
    });
    return;
  }
  const withinGrace = now.diff(reservedAt, 'minutes').minutes < CARD_RESERVATION_GRACE_MINUTES;
  if ((paymentIntent && CHARGING_STATUSES.includes(paymentIntent.status)) || (!paymentIntent && withinGrace)) {
    throw cardPaymentInProgressError(invoice);
  }
  console.log(`Releasing card payment ${reservation.paymentId} on Invoice/${invoiceId}: it never charged`);
  await releaseCardReservation({
    oystehr,
    invoiceId,
    reservation,
  });
}

async function findPaymentIntentForPayment({
  stripe,
  stripeAccount,
  customerId,
  createdFrom,
  invoiceId,
  paymentId,
}: {
  stripe: Stripe;
  stripeAccount: string | undefined;
  customerId: string;
  createdFrom: DateTime;
  invoiceId: string;
  paymentId: string;
}): Promise<Stripe.PaymentIntent | undefined> {
  let startingAfter: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const page = await stripe.paymentIntents.list(
      {
        customer: customerId,
        created: {
          gte: createdFrom.toUnixInteger(),
        },
        limit: 100,
        ...(startingAfter
          ? {
              starting_after: startingAfter,
            }
          : {}),
      },
      {
        stripeAccount,
      }
    );
    const found = page.data.find(
      (intent) =>
        intent.metadata?.[STRIPE_METADATA_KEYS.invoiceId] === invoiceId &&
        intent.metadata?.[STRIPE_METADATA_KEYS.invoicePaymentId] === paymentId
    );
    if (found) return found;
    startingAfter = page.data.at(-1)?.id;
    hasMore = page.has_more && startingAfter !== undefined;
  }
  return undefined;
}

// A retry renews its reservation so settlement can't release it mid-charge. Undefined once recorded
export async function reserveCardPayment({
  oystehr,
  invoiceId,
  paymentId,
  amountInCents,
  now = DateTime.now(),
}: {
  oystehr: Oystehr;
  invoiceId: string;
  paymentId: string;
  amountInCents: number;
  now?: DateTime;
}): Promise<
  | {
      invoice: Invoice;
      reservation: InvoiceCardPaymentReservation;
    }
  | undefined
> {
  const reservation = {
    paymentId,
    reservedAt: now.toUTC().toISO()!,
  };
  return withVersionConflictRetries(async () => {
    const { invoice, recorded } = await readPayableInvoice({
      oystehr,
      invoiceId,
      paymentId,
      amountInCents,
    });
    if (recorded) return undefined;
    await oystehr.fhir.patch(
      {
        resourceType: 'Invoice',
        id: invoiceId,
        operations: cardPaymentReservationOperations(invoice, reservation),
      },
      {
        optimisticLockingVersionId: invoice.meta?.versionId,
      }
    );
    return {
      invoice,
      reservation,
    };
  });
}

// Releases only the reservation as it was read, so a renewed one stays.
export async function releaseCardReservation({
  oystehr,
  invoiceId,
  reservation,
}: {
  oystehr: Oystehr;
  invoiceId: string;
  reservation: InvoiceCardPaymentReservation;
}): Promise<void> {
  await patchWithOptimisticLock(
    oystehr,
    {
      ...(await fetchById<Invoice>(oystehr, 'Invoice', invoiceId)),
      id: invoiceId,
    },
    (current) => {
      const held = getInvoiceCardPaymentReservation(current);
      return held?.paymentId === reservation.paymentId && held.reservedAt === reservation.reservedAt
        ? cardPaymentReservationOperations(current, undefined)
        : [];
    }
  );
}
