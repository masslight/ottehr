import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { PatientPaymentVisit, PatientStripeCustomer } from 'utils/lib/types/api/patient-payment-visits.types';
import { ListBillingPatientPaymentMethodsInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { ListBillingPatientPaymentMethodsResponse } from 'utils/lib/types/data/billing/billing.types';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { getPatientPaymentVisits } from '../ehr-payment-data';
import { createBillingClient, fetchById, resolveClinicalPatientIds } from '../shared';
import { listCustomerCards, STRIPE_CARD_LIST_TIMEOUT_MS } from '../stripe-cards';

const ZAMBDA_NAME = 'list-billing-patient-payment-methods';

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
      ? await listCustomerCards(getStripeClient(secrets, { timeoutMs: STRIPE_CARD_LIST_TIMEOUT_MS }), customer)
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
