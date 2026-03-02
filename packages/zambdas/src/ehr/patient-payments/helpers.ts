import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Account, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  CashPaymentDTO,
  checkForStripeCustomerDeletedError,
  convertPaymentNoticeListToCashPaymentDTOs,
  getStripeAccountForAppointmentOrEncounter,
  getStripeCustomerIdFromAccount,
  PatientPaymentDTO,
  PAYMENT_METHOD_EXTENSION_URL,
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

  return buildPaymentDTOs(fhirPaymentNotices, stripePayments, paymentMethods, stripeClient, stripeAccount, encounterId);
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

  return buildPaymentDTOs(fhirPaymentNotices, stripePayments, paymentMethods, stripeClient, stripeAccount, encounterId);
};

const resolvePaymentMethodIdForIntent = async (
  paymentIntent: Stripe.PaymentIntent,
  stripeClient: Stripe,
  stripeAccount?: string
): Promise<string | undefined> => {
  if (typeof paymentIntent.payment_method === 'string') {
    return paymentIntent.payment_method;
  }

  try {
    const expandedIntent = await stripeClient.paymentIntents.retrieve(
      paymentIntent.id,
      {
        expand: ['latest_charge'],
      },
      {
        stripeAccount,
      }
    );

    if (typeof expandedIntent.payment_method === 'string') {
      return expandedIntent.payment_method;
    }

    const latestCharge =
      expandedIntent.latest_charge && typeof expandedIntent.latest_charge !== 'string'
        ? expandedIntent.latest_charge
        : undefined;

    const generatedCard =
      latestCharge?.payment_method_details?.type === 'card_present'
        ? latestCharge.payment_method_details.card_present?.generated_card
        : undefined;

    return generatedCard ?? undefined;
  } catch (error) {
    console.error('Error resolving Stripe payment method for payment intent', paymentIntent.id, error);
    return undefined;
  }
};

const resolvePaymentIntentById = async (
  paymentIntentId: string,
  stripeClient: Stripe,
  stripeAccount?: string
): Promise<Stripe.PaymentIntent | undefined> => {
  try {
    return await stripeClient.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ['latest_charge'],
      },
      {
        stripeAccount,
      }
    );
  } catch (error) {
    console.error('Error retrieving Stripe payment intent', paymentIntentId, error);
    return undefined;
  }
};

const getCardDetails = (
  stripePaymentMethod: Stripe.PaymentMethod | undefined,
  paymentIntent: Stripe.PaymentIntent | undefined
): { cardBrand?: string; cardLast4?: string } => {
  const cardBrandFromPaymentMethod = stripePaymentMethod?.card?.brand ?? stripePaymentMethod?.card_present?.brand;
  const cardLast4FromPaymentMethod = stripePaymentMethod?.card?.last4 ?? stripePaymentMethod?.card_present?.last4;

  const latestCharge =
    paymentIntent?.latest_charge && typeof paymentIntent.latest_charge !== 'string'
      ? paymentIntent.latest_charge
      : undefined;

  const chargeCardPresentDetails =
    latestCharge?.payment_method_details?.type === 'card_present'
      ? latestCharge.payment_method_details.card_present
      : undefined;

  const cardBrandFromCharge = chargeCardPresentDetails?.brand;
  const cardLast4FromCharge = chargeCardPresentDetails?.last4;

  return {
    cardBrand: cardBrandFromPaymentMethod ?? cardBrandFromCharge ?? undefined,
    cardLast4: cardLast4FromPaymentMethod ?? cardLast4FromCharge ?? undefined,
  };
};

async function buildPaymentDTOs(
  fhirPaymentNotices: PaymentNotice[],
  stripePayments: Stripe.PaymentIntent[],
  paymentMethods: Stripe.PaymentMethod[],
  stripeClient: Stripe,
  stripeAccount: string | undefined,
  encounterId?: string
): Promise<PatientPaymentDTO[]> {
  const paymentMethodCache = new Map<string, Stripe.PaymentMethod>(paymentMethods.map((pm) => [pm.id, pm]));
  const paymentIntentCache = new Map<string, Stripe.PaymentIntent>(stripePayments.map((pi) => [pi.id, pi]));

  const cardPaymentsNested: PatientPaymentDTO[][] = await Promise.all(
    fhirPaymentNotices.map(async (paymentNotice) => {
      const pnStripeId = paymentNotice.identifier?.find((id) => id.system === STRIPE_PAYMENT_ID_SYSTEM)?.value;
      if (!pnStripeId) {
        return [];
      }

      const paymentMethodExtension = paymentNotice.extension?.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)
        ?.valueString;

      if (paymentMethodExtension === 'cash' || paymentMethodExtension === 'check') {
        return [];
      }

      const paymentMethod = paymentMethodExtension === 'card-reader' ? 'card-reader' : 'card';
      let paymentIntent = paymentIntentCache.get(pnStripeId);
      if (!paymentIntent) {
        const retrievedPaymentIntent = await resolvePaymentIntentById(pnStripeId, stripeClient, stripeAccount);
        if (retrievedPaymentIntent) {
          paymentIntent = retrievedPaymentIntent;
          paymentIntentCache.set(retrievedPaymentIntent.id, retrievedPaymentIntent);
        }
      }

      const stripePaymentId = paymentIntent?.id ?? pnStripeId;

      let paymentMethodId =
        paymentIntent && typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : undefined;

      if (!paymentMethodId && paymentIntent) {
        paymentMethodId = await resolvePaymentMethodIdForIntent(paymentIntent, stripeClient, stripeAccount);
      }

      let stripePaymentMethod: Stripe.PaymentMethod | undefined;
      if (paymentMethodId) {
        stripePaymentMethod = paymentMethodCache.get(paymentMethodId);

        if (!stripePaymentMethod) {
          try {
            const retrievedPaymentMethod = await stripeClient.paymentMethods.retrieve(paymentMethodId, {
              stripeAccount,
            });

            stripePaymentMethod = retrievedPaymentMethod;
            paymentMethodCache.set(paymentMethodId, retrievedPaymentMethod);
          } catch (error) {
            console.error('Error retrieving Stripe payment method', paymentMethodId, error);
          }
        }
      }

      const { cardBrand, cardLast4: last4 } = getCardDetails(stripePaymentMethod, paymentIntent);
      const dateISO = DateTime.fromISO(paymentNotice.created).toISO();

      if (!dateISO || !paymentNotice.id) {
        console.log('missing data for payment notice:', paymentNotice.id, 'dateISO', dateISO);
        return [];
      }

      if (paymentMethod === 'card-reader') {
        return [
          {
            paymentMethod: 'card-reader',
            amountInCents: (paymentNotice.amount.value ?? 0) * 100,
            description: paymentIntent?.description ?? undefined,
            fhirPaymentNotificationId: paymentNotice.id,
            cardBrand,
            cardLast4: last4,
            dateISO,
          },
        ];
      }

      return [
        {
          paymentMethod: 'card' as const,
          stripePaymentId,
          amountInCents: (paymentNotice.amount.value ?? 0) * 100,
          description: paymentIntent?.description ?? undefined,
          stripePaymentMethodId: paymentMethodId,
          fhirPaymentNotificationId: paymentNotice.id,
          cardBrand,
          cardLast4: last4,
          dateISO,
        },
      ];
    })
  );

  const cardPayments: PatientPaymentDTO[] = cardPaymentsNested.flat().slice(0, 20);

  // todo: the data here should be fetched from candid and then linked to the payment notice ala stripe,
  // but that awaits the candid integration portion
  const cashPayments: CashPaymentDTO[] = convertPaymentNoticeListToCashPaymentDTOs(fhirPaymentNotices, encounterId);

  const deDuplicatedCashPayments = cashPayments.filter((cashPayment) => {
    if (!cashPayment.fhirPaymentNotificationId) {
      return true;
    }

    return !cardPayments.some(
      (cardPayment) => cardPayment.fhirPaymentNotificationId === cashPayment.fhirPaymentNotificationId
    );
  });

  const payments: PatientPaymentDTO[] = [...cardPayments, ...deDuplicatedCashPayments].sort((a, b) => {
    return DateTime.fromISO(b.dateISO).toMillis() - DateTime.fromISO(a.dateISO).toMillis();
  });

  return payments;
}
