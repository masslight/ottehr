import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Account, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  CardPaymentDTO,
  CashPaymentDTO,
  checkForStripeCustomerDeletedError,
  convertPaymentNoticeListToCashPaymentDTOs,
  getStripeAccountForAppointmentOrEncounter,
  getStripeCustomerIdFromAccount,
  PatientPaymentDTO,
} from 'utils';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../shared';

interface GetPaymentsForEncounterInput {
  oystehrClient: Oystehr;
  stripeClient: Stripe;
  account: Account;
  encounterId: string;
  patientId: string;
}

interface GetPaymentsForPatientInput {
  oystehrClient: Oystehr;
  stripeClient: Stripe;
  account: Account;
  patientId: string;
  encounterId?: string;
}

export const getPaymentsForEncounter = async (input: GetPaymentsForEncounterInput): Promise<PatientPaymentDTO[]> => {
  const { oystehrClient, stripeClient, account, encounterId } = input;

  const fhirPaymentNotices: PaymentNotice[] = (
    await oystehrClient.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [
        {
          name: 'request',
          value: `Encounter/${encounterId}`,
        },
      ],
    })
  ).unbundle();

  const stripePayments: Stripe.PaymentIntent[] = [];
  const paymentMethods: Stripe.PaymentMethod[] = [];

  const stripeAccount = await getStripeAccountForAppointmentOrEncounter({ encounterId }, oystehrClient);
  console.log('found a stripe account from the schedule owner, ', stripeAccount);

  const customerId = getStripeCustomerIdFromAccount(account, stripeAccount);

  if (encounterId && customerId) {
    try {
      const [paymentIntents, pms] = await Promise.all([
        stripeClient.paymentIntents.search(
          {
            query: `metadata['encounterId']:"${encounterId}" OR metadata['oystehr_encounter_id']:"${encounterId}"`,
            limit: 20, // default is 10
          },
          {
            stripeAccount, // Connected account ID if any
          }
        ),
        stripeClient.paymentMethods.list(
          {
            customer: customerId,
            type: 'card',
          },
          {
            stripeAccount, // Connected account ID if any
          }
        ),
      ]);

      console.log('Payment Intent search results:', JSON.stringify(paymentIntents, null, 2));
      stripePayments.push(...paymentIntents.data);
      paymentMethods.push(...pms.data);
    } catch (error) {
      console.error('Error fetching payment intents or payment methods for encounter:', error);
      throw checkForStripeCustomerDeletedError(error);
    }
  } else if (customerId) {
    try {
      const [paymentIntents, pms] = await Promise.all([
        stripeClient.paymentIntents.list(
          {
            customer: customerId,
          },
          {
            stripeAccount, // Connected account ID if any
          }
        ),
        stripeClient.paymentMethods.list(
          {
            customer: customerId,
            type: 'card',
          },
          {
            stripeAccount, // Connected account ID if any
          }
        ),
      ]);

      console.log('Payment Intent list results (fallback):', JSON.stringify(paymentIntents, null, 2));
      stripePayments.push(...paymentIntents.data);
      paymentMethods.push(...pms.data);
    } catch (error) {
      console.error('Error fetching payment intents or payment methods:', error);
      throw checkForStripeCustomerDeletedError(error);
    }
  }

  return buildPaymentDTOs(fhirPaymentNotices, stripePayments, paymentMethods, encounterId);
};

export const getPaymentsForPatient = async (input: GetPaymentsForPatientInput): Promise<PatientPaymentDTO[]> => {
  const { oystehrClient, stripeClient, account, patientId, encounterId } = input;

  const params: SearchParam[] = encounterId
    ? [{ name: 'request', value: `Encounter/${encounterId}` }]
    : [{ name: 'request.patient._id', value: patientId }];

  const fhirPaymentNotices: PaymentNotice[] = (
    await oystehrClient.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params,
    })
  ).unbundle();

  const stripePayments: Stripe.PaymentIntent[] = [];
  const paymentMethods: Stripe.PaymentMethod[] = [];

  const stripeAccount = await getStripeAccountForAppointmentOrEncounter({ encounterId }, oystehrClient);
  console.log('found a stripe account from the schedule owner, ', stripeAccount);

  const customerId = getStripeCustomerIdFromAccount(account, stripeAccount);

  if (encounterId && customerId) {
    try {
      const [paymentIntents, pms] = await Promise.all([
        stripeClient.paymentIntents.search(
          {
            query: `metadata['encounterId']:"${encounterId}" OR metadata['oystehr_encounter_id']:"${encounterId}"`,
            limit: 20,
          },
          {
            stripeAccount, // Connected account ID if any
          }
        ),
        stripeClient.paymentMethods.list(
          {
            customer: customerId,
            type: 'card',
          },
          {
            stripeAccount, // Connected account ID if any
          }
        ),
      ]);

      console.log('Payment Intent created:', JSON.stringify(paymentIntents, null, 2));
      stripePayments.push(...paymentIntents.data);
      paymentMethods.push(...pms.data);
    } catch (error) {
      console.error('Error fetching payment intents or payment methods for encounter:', error);
      throw checkForStripeCustomerDeletedError(error);
    }
  } else if (customerId) {
    try {
      const [paymentIntents, pms] = await Promise.all([
        stripeClient.paymentIntents.list(
          {
            customer: customerId,
          },
          {
            stripeAccount, // Connected account ID if any
          }
        ),
        stripeClient.paymentMethods.list(
          {
            customer: customerId,
            type: 'card',
          },
          {
            stripeAccount, // Connected account ID if any
          }
        ),
      ]);

      console.log('Payment Intent list results:', JSON.stringify(paymentIntents, null, 2));
      stripePayments.push(...paymentIntents.data);
      paymentMethods.push(...pms.data);
    } catch (error) {
      console.error('Error fetching payment intents or payment methods:', error);
      throw checkForStripeCustomerDeletedError(error);
    }
  }

  return buildPaymentDTOs(fhirPaymentNotices, stripePayments, paymentMethods, encounterId);
};

function buildPaymentDTOs(
  fhirPaymentNotices: PaymentNotice[],
  stripePayments: Stripe.PaymentIntent[],
  paymentMethods: Stripe.PaymentMethod[],
  encounterId?: string
): PatientPaymentDTO[] {
  const cardPayments: CardPaymentDTO[] = fhirPaymentNotices
    .flatMap((paymentNotice) => {
      const pnStripeId = paymentNotice.identifier?.find((id) => id.system === STRIPE_PAYMENT_ID_SYSTEM)?.value;
      if (!pnStripeId) {
        // not a card payment, skip!
        return [];
      }

      const paymentIntent = stripePayments.find((pi) => pi.id === pnStripeId);
      const stripePaymentId = paymentIntent ? paymentIntent.id : pnStripeId;
      const last4 = paymentMethods.find((pm) => pm.id === paymentIntent?.payment_method)?.card?.last4;
      const paymentMethodId = paymentMethods.find((pm) => pm.id === paymentIntent?.payment_method)?.id;
      const dateISO = DateTime.fromISO(paymentNotice.created).toISO();

      if (!dateISO || !paymentNotice.id) {
        console.log('missing data for payment notice:', paymentNotice.id, 'dateISO', dateISO);
        return [];
      }

      return {
        paymentMethod: 'card' as const,
        stripePaymentId,
        amountInCents: (paymentNotice.amount.value ?? 0) * 100,
        description: paymentIntent?.description ?? undefined,
        stripePaymentMethodId: paymentMethodId,
        fhirPaymentNotificationId: paymentNotice.id,
        cardLast4: last4,
        dateISO,
      };
    })
    .slice(0, 20); // We only fetch the last 20 payments from stripe, which should be more than enough for pretty much any real world use case

  // todo: the data here should be fetched from candid and then linked to the payment notice ala stripe,
  // but that awaits the candid integration portion
  const cashPayments: CashPaymentDTO[] = convertPaymentNoticeListToCashPaymentDTOs(fhirPaymentNotices, encounterId);

  const payments: PatientPaymentDTO[] = [...cardPayments, ...cashPayments].sort((a, b) => {
    return DateTime.fromISO(b.dateISO).toMillis() - DateTime.fromISO(a.dateISO).toMillis();
  });

  return payments;
}
