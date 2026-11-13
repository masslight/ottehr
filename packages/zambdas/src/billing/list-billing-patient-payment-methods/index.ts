import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { PatientPaymentVisit, PatientStripeCustomer } from 'utils/lib/types/api/patient-payment-visits.types';
import { ListBillingPatientPaymentMethodsInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  BillingPatientCard,
  ListBillingPatientPaymentMethodsResponse,
} from 'utils/lib/types/data/billing/billing.types';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { getPatientPaymentVisits } from '../ehr-payment-data';
import { createBillingClient, fetchById, resolveClinicalPatientIds } from '../shared';

const ZAMBDA_NAME = 'list-billing-patient-payment-methods';
const STRIPE_REQUEST_TIMEOUT_MS = 10_000;

let m2mToken: string;

// Lists the saved cards a billing user can charge for one of the patient's visits. Cards are saved on
// the patient's Stripe customer in the account the visit takes payments on, the same customer
// post-billing-patient-payment charges.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, encounterId, secrets } = validateWithSchema(ListBillingPatientPaymentMethodsInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const billingOystehr = createBillingClient(m2mToken, secrets);

  const patient = await fetchById<Patient>(billingOystehr, 'Patient', patientId);
  const { clinicalId } = await resolveClinicalPatientIds({ oystehr: billingOystehr, patient });
  if (!clinicalId) {
    throw FHIR_RESOURCE_NOT_FOUND('Encounter');
  }

  const { visits, stripeCustomers } = await getPatientPaymentVisits(billingOystehr, clinicalId, encounterId);
  const visit = visits.find((candidate) => candidate.encounterId === encounterId);
  if (!visit) {
    throw FHIR_RESOURCE_NOT_FOUND('Encounter');
  }

  const customer = customerForScheduleOwner(stripeCustomers, visit.scheduleOwner);
  const response: ListBillingPatientPaymentMethodsResponse = {
    cards: customer
      ? await listCustomerCards(getStripeClient(secrets, { timeoutMs: STRIPE_REQUEST_TIMEOUT_MS }), customer)
      : [],
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});

// undefined stripeAccount on both sides is the platform account. A visit without a schedule owner (an
// appointment-less follow-up) has no account to charge on: post-billing-patient-payment rejects it, so
// it has no chargeable customer rather than falling back to the platform one.
export const customerForScheduleOwner = (
  customers: PatientStripeCustomer[],
  scheduleOwner: PatientPaymentVisit['scheduleOwner']
): PatientStripeCustomer | undefined =>
  scheduleOwner ? customers.find((customer) => customer.stripeAccount === scheduleOwner.stripeAccount) : undefined;

export const listCustomerCards = async (
  stripeClient: Stripe,
  { customerId, stripeAccount }: PatientStripeCustomer
): Promise<BillingPatientCard[]> => {
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
      .flatMap((paymentMethod): BillingPatientCard[] =>
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
