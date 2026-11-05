import Oystehr from '@oystehr/sdk';
import { PaymentNotice } from 'fhir/r4b';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  GetEncounterPaymentNoticeInput,
  GetEncounterPaymentNoticeResponse,
} from 'utils/lib/types/api/encounter-payment-notice.types';

// Billing's door to the patient payments the EHR recorded before payments moved to billing, and to
// the Stripe account its schedules take payments on: the EHR zambda interface, invoked over the
// wire. Billing never reads clinical FHIR for them. Any client works, only its zambda API is used.

const getEncounterPaymentNotice = async (
  oystehr: Oystehr,
  input: GetEncounterPaymentNoticeInput
): Promise<GetEncounterPaymentNoticeResponse> => {
  const response = await oystehr.zambda.execute({ id: 'get-encounter-payment-notice', ...input });
  return chooseJson<GetEncounterPaymentNoticeResponse | undefined>(response) ?? {};
};

// the encounter's clinical notice with this id; undefined when it is unknown or another encounter's
export const getClinicalPaymentNotice = async (
  oystehr: Oystehr,
  encounterId: string,
  paymentNoticeId: string
): Promise<PaymentNotice | undefined> =>
  (await getEncounterPaymentNotice(oystehr, { encounterId, paymentNoticeId })).paymentNotice;

// the encounter's clinical notice recording any of these Stripe payments
export const findClinicalPaymentNoticeForStripePayments = async (
  oystehr: Oystehr,
  encounterId: string,
  stripePaymentIds: string[]
): Promise<PaymentNotice | undefined> => {
  const ids = [...new Set(stripePaymentIds)];
  if (ids.length === 0) return undefined;
  return (await getEncounterPaymentNotice(oystehr, { encounterId, stripePaymentIds: ids })).paymentNotice;
};

// the Stripe account the encounter's schedule owner takes payments on, where the EHR took them
export const getEncounterScheduleStripeAccount = async (
  oystehr: Oystehr,
  encounterId: string
): Promise<string | undefined> =>
  (await getEncounterPaymentNotice(oystehr, { encounterId, includeStripeAccount: true })).stripeAccount;
