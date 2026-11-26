import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Invoice, ProvenanceAgent } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { getInvoiceNumber } from 'utils/lib/fhir/billing-invoice';
import { getStripeCustomerIdFromAccount } from 'utils/lib/fhir/helpers';
import { ChargeBillingNioInvoiceCardInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { RecordBillingNioInvoicePaymentResponse } from 'utils/lib/types/data/billing/billing.types';
import {
  BILLING_INVOICE_CONFLICT_ERROR,
  GENERIC_STRIPE_PAYMENT_ERROR,
  parseStripeError,
  STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR,
} from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient, isIdempotencyConflict, STRIPE_METADATA_KEYS } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { releaseCardReservation, reserveCardPayment, settleOtherCardReservation } from '../invoice-card-reservation';
import { cardPaymentInProgressError, recordInvoiceCardPayment } from '../invoice-payments';
import { resolveInvoiceStripePayer } from '../invoice-stripe';
import { resolveClaimActor } from '../provenance';
import { createBillingClient, fetchById } from '../shared';

type ChargeNioInvoiceCardParams = ValidatedZambdaInput<typeof ChargeBillingNioInvoiceCardInputSchema> & {
  agent: ProvenanceAgent;
};

let m2mToken: string;
const ZAMBDA_NAME = 'charge-billing-nio-invoice-card';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateWithSchema(ChargeBillingNioInvoiceCardInputSchema, input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

  console.group('performEffect');
  const response = await performEffect({
    oystehr,
    stripe: getStripeClient(params.secrets),
    params: {
      ...params,
      agent,
    },
  });
  console.groupEnd();
  console.debug('performEffect success');

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

// Reserved before charging. Stripe dedupes by payment id; the webhook records a charge left
// unrecorded.
export async function performEffect({
  oystehr,
  stripe,
  params,
  now = DateTime.now(),
}: {
  oystehr: Oystehr;
  stripe: Stripe;
  params: ChargeNioInvoiceCardParams;
  now?: DateTime;
}): Promise<RecordBillingNioInvoicePaymentResponse> {
  const { invoiceId, amountInCents, paymentMethodId, idempotencyKey: paymentId, agent, secrets } = params;
  // resolved before reserving, so a payer that can't be resolved leaves no reservation behind
  const { stripeAccount, nio } = await resolveInvoiceStripePayer({
    oystehr,
    invoice: await fetchById<Invoice>(oystehr, 'Invoice', invoiceId),
  });
  const customerId = getStripeCustomerIdFromAccount(nio, stripeAccount);
  if (!customerId) throw STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR;

  await settleOtherCardReservation({
    oystehr,
    getStripe: () => stripe,
    invoiceId,
    paymentId,
    agent,
    secrets,
    now,
  });
  const reserved = await reserveCardPayment({
    oystehr,
    invoiceId,
    paymentId,
    amountInCents,
    now,
  });
  if (!reserved) {
    return {
      paymentId,
    };
  }
  const { invoice, reservation } = reserved;
  const release = (): Promise<void> =>
    releaseCardReservation({
      oystehr,
      invoiceId,
      reservation,
    });

  const invoiceNumber = getInvoiceNumber(invoice) ?? invoiceId;
  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        description: `Payment for invoice ${invoiceNumber}`,
        confirm: true,
        off_session: true,
        metadata: {
          [STRIPE_METADATA_KEYS.invoiceId]: invoiceId,
          [STRIPE_METADATA_KEYS.invoicePaymentId]: paymentId,
          [STRIPE_METADATA_KEYS.organizationId]: nio.id!,
        },
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
      },
      {
        stripeAccount,
        idempotencyKey: `nio-invoice-payment-${invoiceId}-${paymentId}`,
      }
    );
  } catch (error) {
    if (!isStripeRefusal(error)) {
      // the card may be charged, so the reservation stays until a later attempt settles it
      console.error(`Charge for invoice ${invoiceNumber} has an unknown outcome`, error);
      throw cardPaymentInProgressError(invoice);
    }
    await release();
    throw parseStripeError(error);
  }
  if (paymentIntent.status === 'processing') throw cardPaymentInProgressError(invoice);
  if (paymentIntent.status !== 'succeeded') {
    await release();
    throw GENERIC_STRIPE_PAYMENT_ERROR;
  }

  try {
    await recordInvoiceCardPayment({
      oystehr,
      invoiceId,
      paymentId,
      amountInCents,
      chargedAt: DateTime.fromSeconds(paymentIntent.created),
      stripePaymentId: paymentIntent.id,
      stripeAccount,
      agent,
      secrets,
    });
  } catch (error) {
    console.error(`Charged ${paymentIntent.id} for invoice ${invoiceNumber} but could not record it`, error);
    throw BILLING_INVOICE_CONFLICT_ERROR(
      `The card was charged (${paymentIntent.id}), but the payment couldn't be recorded on invoice ` +
        `${invoiceNumber}. Refresh the invoice before trying again.`
    );
  }

  return {
    paymentId,
  };
}

// declined or rejected, so nothing was charged
const isStripeRefusal = (error: unknown): boolean => {
  const type = (error as { type?: string } | undefined)?.type;
  return (type === 'StripeCardError' || type === 'StripeInvalidRequestError') && !isIdempotencyConflict(error);
};
