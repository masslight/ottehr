import Oystehr from '@oystehr/sdk';
import { Account, PaymentNotice, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { getStripeCustomerIdFromAccount } from 'utils/lib/fhir/helpers';
import { getFirstName, getLastName } from 'utils/lib/fhir/patient';
import {
  isLocallyRecordedRefund,
  isPendingReservation,
  mergeStripeRefundsWithStored,
  parsePaymentRefundsFromNotice,
  settledRefundTotalInCents,
  staleReservationIds,
} from 'utils/lib/fhir/paymentRefunds';
import { getPaymentNoticeSubmitterRef, getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import { convertPaymentNoticeListToCashPaymentDTOs } from 'utils/lib/helpers/helpers';
import { CashPaymentDTO, PatientPaymentDTO, PaymentRefundDTO } from 'utils/lib/types/api/patient-payment-types';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  checkForStripeCustomerDeletedError,
  SCHEDULE_NOT_FOUND_ERROR,
} from 'utils/lib/types/errors';
import {
  applyRefundsToPaymentNotice,
  stripeEncounterMetadataQuery,
  stripeRefundToDTO,
} from '../shared/stripeIntegration';
import {
  createStripeAccountResolver,
  fetchEncounterPaymentNotices,
  isBillingPaymentNotice,
  paymentMethodForNotice,
  stripeIdsForPaymentNotice,
  stripePaymentIntentIdForNotice,
} from './patient-payments';
import { stampedStripeAccount } from './payments';

interface GetPaymentsForEncounterInput {
  // reads Account, Encounter, Practitioner and legacy EHR PaymentNotices
  clinicalOystehr: Oystehr;
  // reads billing PaymentNotices and keeps their refund stamps current
  billingOystehr: Oystehr;
  stripeClient: Stripe;
  // holds the patient's Stripe customer ids; without it card details come from each payment alone
  account: Account | undefined;
  encounterId: string;
  // the encounter's merged notices, when the caller already fetched them in bulk
  fhirPaymentNotices?: PaymentNotice[];
  // the EHR visit list shows at most CARD_PAYMENT_LIMIT card payments; listings that must be complete lift the cap
  uncappedCardPayments?: boolean;
}

const CARD_PAYMENT_LIMIT = 20;

export const getPaymentsForEncounter = async (input: GetPaymentsForEncounterInput): Promise<PatientPaymentDTO[]> => {
  const { clinicalOystehr, billingOystehr, stripeClient, account, encounterId } = input;

  const fhirPaymentNotices =
    input.fhirPaymentNotices ??
    (await fetchEncounterPaymentNotices({ clinicalOystehr, billingOystehr, encounterIds: [encounterId] })).get(
      encounterId
    ) ??
    [];

  const stripePayments: Stripe.PaymentIntent[] = [];
  const paymentMethods: Stripe.PaymentMethod[] = [];

  // Each payment's Stripe lookups use the account it was taken on. Only a Stripe payment without an
  // account stamp falls back to the schedule owner's, where the EHR takes payments, so only then is
  // the schedule looked up and the encounter's payments prefetched from it: an encounter with no
  // appointment has no schedule, and its manual or stamped payments need none.
  const needsSchedule = fhirPaymentNotices.some(
    (notice) => stripePaymentIntentIdForNotice(notice) && !stampedStripeAccount(notice)
  );
  const { found: scheduleFound, stripeAccount } = needsSchedule
    ? await lookUpScheduleStripeAccount(encounterId, clinicalOystehr)
    : { found: false };
  const scheduleAccount = needsSchedule ? Promise.resolve(stripeAccount) : undefined;
  if (scheduleFound) console.log('found a stripe account from the schedule owner, ', stripeAccount);
  const stripeAccountFor = createStripeAccountResolver({
    billingOystehr,
    clinicalOystehr,
    encounterId,
    scheduleAccount,
  });

  const customerId = scheduleFound && account ? getStripeCustomerIdFromAccount(account, stripeAccount) : undefined;

  if (customerId) {
    try {
      const [paymentIntents, pms] = await Promise.all([
        stripeClient.paymentIntents.search(
          {
            query: stripeEncounterMetadataQuery(encounterId),
            limit: 20, // default is 10
            expand: ['data.latest_charge'],
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
  }

  return buildPaymentDTOs(
    fhirPaymentNotices,
    stripePayments,
    paymentMethods,
    stripeClient,
    stripeAccountFor,
    clinicalOystehr,
    billingOystehr,
    input.uncappedCardPayments ? undefined : CARD_PAYMENT_LIMIT
  );
};

// An encounter whose appointment or schedule is gone has no schedule owner. Its unstamped Stripe
// payments are still listed, from FHIR alone, rather than failing the whole list.
const lookUpScheduleStripeAccount = async (
  encounterId: string,
  clinicalOystehr: Oystehr
): Promise<{ found: boolean; stripeAccount?: string }> => {
  try {
    return {
      found: true,
      stripeAccount: await getStripeAccountForAppointmentOrEncounter({ encounterId }, clinicalOystehr),
    };
  } catch (error) {
    const code = (error as { code?: unknown } | undefined)?.code;
    if (code !== APPOINTMENT_NOT_FOUND_ERROR.code && code !== SCHEDULE_NOT_FOUND_ERROR.code) throw error;
    console.warn(`No schedule owner for encounter ${encounterId}; listing its Stripe payments without Stripe details`);
    return { found: false };
  }
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

// pulls refund state from Stripe (falling back to what is stamped on the notice) and keeps the notice in sync
const resolveRefundsForPaymentNotice = async (
  paymentNotice: PaymentNotice,
  paymentIntent: Stripe.PaymentIntent | undefined,
  stripeClient: Stripe,
  stripeAccount: string | undefined,
  billingOystehr: Oystehr
): Promise<PaymentRefundDTO[] | undefined> => {
  // legacy EHR notices are read-only here; their state is re-derived from Stripe on every read
  const persistRefunds = async (refunds: PaymentRefundDTO[], removeIds: string[]): Promise<void> => {
    if (!isBillingPaymentNotice(paymentNotice)) return;
    await applyRefundsToPaymentNotice(billingOystehr, paymentNotice, refunds, removeIds);
  };
  const storedRefunds = parsePaymentRefundsFromNotice(paymentNotice);
  // reservations superseded by their Stripe refund or expired unclaimed must not keep counting
  const staleIds = staleReservationIds(storedRefunds);
  const activeStored = staleIds.length
    ? storedRefunds?.filter((refund) => !staleIds.includes(refund.stripeRefundId))
    : storedRefunds;
  // externally recorded refunds have no Stripe counterpart, so they never participate in the Stripe reconciliation
  const storedStripeRefunds = (storedRefunds ?? []).filter((refund) => !isLocallyRecordedRefund(refund));
  const latestCharge =
    paymentIntent?.latest_charge && typeof paymentIntent.latest_charge !== 'string'
      ? paymentIntent.latest_charge
      : undefined;
  const stripeShowsRefunds = (latestCharge?.amount_refunded ?? 0) > 0;

  if (!paymentIntent || (!stripeShowsRefunds && !storedStripeRefunds.length)) {
    if (staleIds.length) {
      try {
        await persistRefunds(activeStored ?? [], staleIds);
      } catch (error) {
        console.error('Error clearing stale refund reservations on notice', paymentNotice.id, error);
      }
    }
    return activeStored;
  }

  // skip the Stripe round-trip when the stamped state is provably current and nothing needs cleanup
  const storedAreTerminal = storedStripeRefunds.every((refund) =>
    ['succeeded', 'failed', 'canceled'].includes(refund.status ?? '')
  );
  if (
    latestCharge &&
    staleIds.length === 0 &&
    storedStripeRefunds.length &&
    storedAreTerminal &&
    settledRefundTotalInCents(storedStripeRefunds) === latestCharge.amount_refunded
  ) {
    return storedRefunds;
  }

  try {
    const refundList = await stripeClient.refunds.list(
      { payment_intent: paymentIntent.id, limit: 100 },
      { stripeAccount }
    );
    const stripeDTOs = refundList.data.map(stripeRefundToDTO);
    // freshly created Stripe refunds may claim reservations the stored data didn't know about yet
    const allStaleIds = staleReservationIds([...(storedRefunds ?? []), ...stripeDTOs]);
    const refunds = mergeStripeRefundsWithStored(storedRefunds, stripeDTOs, allStaleIds);
    await persistRefunds(refunds, allStaleIds);
    return refunds;
  } catch (error) {
    console.error('Error fetching refunds for payment intent', paymentIntent.id, error);
    return activeStored;
  }
};

// Submitter names by notice id. Notices written since the display was stamped on the submitter
// reference resolve locally; older ones fall back to one batched Practitioner lookup.
const resolveTakenByNames = async (
  fhirPaymentNotices: PaymentNotice[],
  clinicalOystehr: Oystehr
): Promise<Map<string, string>> => {
  const takenByByNoticeId = new Map<string, string>();
  const noticeIdsByPractitionerId = new Map<string, string[]>();

  for (const notice of fhirPaymentNotices) {
    if (!notice.id) continue;
    const submitter = getPaymentNoticeSubmitterRef(notice);
    if (!submitter?.reference) continue;
    if (submitter.display) {
      takenByByNoticeId.set(notice.id, submitter.display);
      continue;
    }
    const [resourceType, resourceId] = submitter.reference.split('/');
    if (resourceType !== 'Practitioner' || !resourceId) continue;
    noticeIdsByPractitionerId.set(resourceId, [...(noticeIdsByPractitionerId.get(resourceId) ?? []), notice.id]);
  }

  if (noticeIdsByPractitionerId.size > 0) {
    try {
      const practitioners = (
        await clinicalOystehr.fhir.search<Practitioner>({
          resourceType: 'Practitioner',
          params: [{ name: '_id', value: [...noticeIdsByPractitionerId.keys()].join(',') }],
        })
      ).unbundle();
      for (const practitioner of practitioners) {
        if (!practitioner.id) continue;
        // first + last only, matching the display stamped at write time
        const name = [getFirstName(practitioner), getLastName(practitioner)].filter(Boolean).join(' ');
        if (!name) continue;
        for (const noticeId of noticeIdsByPractitionerId.get(practitioner.id) ?? []) {
          takenByByNoticeId.set(noticeId, name);
        }
      }
    } catch (error) {
      console.error('Error resolving payment submitter names', error);
    }
  }

  return takenByByNoticeId;
};

// methods the cash converter lists from FHIR alone
const FHIR_ONLY_PAYMENT_METHODS = ['cash', 'check', 'external-card-reader', 'other'];

// A card payment Stripe recorded as a bare charge, with no PaymentIntent (e.g. one made through the
// Charges API): the webhook stores it under its charge id only. It is listed from FHIR with the
// card details on the charge; its refunds are the ones the webhook stamped on the notice.
const buildChargeOnlyPaymentDTOs = async (
  paymentNotice: PaymentNotice,
  stripeClient: Stripe,
  stripeAccountFor: (notice: PaymentNotice) => Promise<string | undefined>,
  billingOystehr: Oystehr,
  takenBy: string | undefined
): Promise<PatientPaymentDTO[]> => {
  const chargeId = stripeIdsForPaymentNotice(paymentNotice).find((id) => id.startsWith('ch_') || id.startsWith('py_'));
  const method = paymentMethodForNotice(paymentNotice);
  const dateISO = DateTime.fromISO(paymentNotice.created).toISO();
  if (!chargeId || (method && FHIR_ONLY_PAYMENT_METHODS.includes(method)) || !dateISO || !paymentNotice.id) {
    return [];
  }

  let stripeAccount: string | undefined;
  let charge: Stripe.Charge | undefined;
  try {
    // an unstamped notice falls back to the schedule owner, which the encounter may not have
    stripeAccount = await stripeAccountFor(paymentNotice);
    charge = await stripeClient.charges.retrieve(chargeId, {}, { stripeAccount });
  } catch (error) {
    console.error('Error retrieving Stripe charge', chargeId, error);
  }
  const card = charge?.payment_method_details?.card ?? charge?.payment_method_details?.card_present;

  const refunds = (
    await resolveRefundsForPaymentNotice(paymentNotice, undefined, stripeClient, stripeAccount, billingOystehr)
  )?.filter((refund) => !isPendingReservation(refund));
  const common = {
    amountInCents: Math.round((paymentNotice.amount.value ?? 0) * 100),
    dateISO,
    fhirPaymentNotificationId: paymentNotice.id,
    description: charge?.description ?? undefined,
    cardBrand: card?.brand ?? undefined,
    cardLast4: card?.last4 ?? undefined,
    ...(takenBy ? { takenBy } : {}),
    ...(refunds?.length ? { refunds, refundedAmountInCents: settledRefundTotalInCents(refunds) } : {}),
  };
  // no stripePaymentId: the refund endpoint needs a PaymentIntent, so the EHR offers no refund
  if (method === 'card-reader') return [{ paymentMethod: 'card-reader', ...common }];
  return [{ paymentMethod: 'card', stripePaymentId: undefined, stripePaymentMethodId: undefined, ...common }];
};

async function buildPaymentDTOs(
  fhirPaymentNotices: PaymentNotice[],
  stripePayments: Stripe.PaymentIntent[],
  paymentMethods: Stripe.PaymentMethod[],
  stripeClient: Stripe,
  stripeAccountFor: (notice: PaymentNotice) => Promise<string | undefined>,
  clinicalOystehr: Oystehr,
  billingOystehr: Oystehr,
  // undefined keeps every card payment
  cardPaymentLimit: number | undefined
): Promise<PatientPaymentDTO[]> {
  const paymentMethodCache = new Map<string, Stripe.PaymentMethod>(paymentMethods.map((pm) => [pm.id, pm]));
  const paymentIntentCache = new Map<string, Stripe.PaymentIntent>(stripePayments.map((pi) => [pi.id, pi]));
  const takenByByNoticeId = await resolveTakenByNames(fhirPaymentNotices, clinicalOystehr);

  const cardPaymentsNested: PatientPaymentDTO[][] = await Promise.all(
    fhirPaymentNotices.map(async (paymentNotice) => {
      const pnStripeId = stripePaymentIntentIdForNotice(paymentNotice);
      if (!pnStripeId) {
        return buildChargeOnlyPaymentDTOs(
          paymentNotice,
          stripeClient,
          stripeAccountFor,
          billingOystehr,
          takenByByNoticeId.get(paymentNotice.id ?? '')
        );
      }

      const paymentMethodExtension = paymentMethodForNotice(paymentNotice);

      if (paymentMethodExtension === 'cash' || paymentMethodExtension === 'check') {
        return [];
      }

      const paymentMethod = paymentMethodExtension === 'card-reader' ? 'card-reader' : 'card';
      const stripeAccount = await stripeAccountFor(paymentNotice);
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
      const amountInCents = Math.round((paymentNotice.amount.value ?? 0) * 100);

      if (!dateISO || !paymentNotice.id) {
        console.log('missing data for payment notice:', paymentNotice.id, 'dateISO', dateISO);
        return [];
      }

      const refunds = await resolveRefundsForPaymentNotice(
        paymentNotice,
        paymentIntent,
        stripeClient,
        stripeAccount,
        billingOystehr
      );
      // in-flight reservations stay on the notice but are not refunds to show or count
      const displayRefunds = refunds?.filter((refund) => !isPendingReservation(refund));
      const refundFields = displayRefunds?.length
        ? { refunds: displayRefunds, refundedAmountInCents: settledRefundTotalInCents(displayRefunds) }
        : {};
      const takenBy = takenByByNoticeId.get(paymentNotice.id);
      const takenByField = takenBy ? { takenBy } : {};

      if (paymentMethod === 'card-reader') {
        return [
          {
            paymentMethod: 'card-reader',
            stripePaymentId,
            amountInCents,
            description: paymentIntent?.description ?? undefined,
            fhirPaymentNotificationId: paymentNotice.id,
            cardBrand,
            cardLast4: last4,
            dateISO,
            ...takenByField,
            ...refundFields,
          },
        ];
      }

      return [
        {
          paymentMethod: 'card' as const,
          stripePaymentId,
          amountInCents,
          description: paymentIntent?.description ?? undefined,
          stripePaymentMethodId: paymentMethodId,
          fhirPaymentNotificationId: paymentNotice.id,
          cardBrand,
          cardLast4: last4,
          dateISO,
          ...takenByField,
          ...refundFields,
        },
      ];
    })
  );

  const cardPayments: PatientPaymentDTO[] = cardPaymentsNested.flat().slice(0, cardPaymentLimit);

  // todo: the data here should be fetched from candid and then linked to the payment notice ala stripe,
  // but that awaits the candid integration portion
  // the notices are already scoped to the encounter; billing ones reference its claim, not the Encounter
  const cashPayments: CashPaymentDTO[] = convertPaymentNoticeListToCashPaymentDTOs(fhirPaymentNotices).map(
    (cashPayment) => {
      if (cashPayment.takenBy || !cashPayment.fhirPaymentNotificationId) return cashPayment;
      const takenBy = takenByByNoticeId.get(cashPayment.fhirPaymentNotificationId);
      return takenBy ? { ...cashPayment, takenBy } : cashPayment;
    }
  );

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
