import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient, PaymentNotice } from 'fhir/r4b';
import Stripe from 'stripe';
import { PatientPaymentVisit } from 'utils/lib/types/api/patient-payment-visits.types';
import { GetBillingPatientAccountPaymentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  BillingPatientAccountPayment,
  GetBillingPatientAccountPaymentResponse,
} from 'utils/lib/types/data/billing/billing.types';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { fetchPatientPaymentsByEncounterIds } from '../claim-amounts';
import { ehrClinicalPaymentLookups, getPatientPaymentVisits } from '../ehr-payment-data';
import { fetchClaimsByEncounter, toAccountPayments } from '../patient-account-payments';
import { listEncounterPayments } from '../patient-payment-dtos';
import { mergeBillingAndLegacyPaymentNotices, shadowsLegacyNotice } from '../patient-payments';
import { BillingOystehr, createBillingClient, fetchById, resolveClinicalPatientIds } from '../shared';

const ZAMBDA_NAME = 'get-billing-patient-account-payment';
const STRIPE_REQUEST_TIMEOUT_MS = 10_000;

let m2mToken: string;

// One payment on a billing patient's account, as list-billing-patient-account-payments shows it, resolved
// from its own visit only: Stripe is queried for that payment alone.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, encounterId, paymentId, secrets } = validateWithSchema(
    GetBillingPatientAccountPaymentInputSchema,
    input
  );

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const billingOystehr = createBillingClient(m2mToken, secrets);

  const patient = await fetchById<Patient>(billingOystehr, 'Patient', patientId);
  const { clinicalId } = await resolveClinicalPatientIds({ oystehr: billingOystehr, patient });
  // payments are taken against clinical visits, so a patient created in billing alone has none
  if (!clinicalId) throw FHIR_RESOURCE_NOT_FOUND('PaymentNotice');

  const response: GetBillingPatientAccountPaymentResponse = {
    payment: await getAccountPayment({
      billingOystehr,
      clinicalPatientId: clinicalId,
      encounterId,
      paymentId,
      stripeClient: getStripeClient(secrets, { timeoutMs: STRIPE_REQUEST_TIMEOUT_MS }),
    }),
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});

export const getAccountPayment = async (params: {
  billingOystehr: BillingOystehr;
  clinicalPatientId: string;
  encounterId: string;
  paymentId: string;
  stripeClient: Stripe;
}): Promise<BillingPatientAccountPayment> => {
  const { billingOystehr, clinicalPatientId, encounterId, paymentId, stripeClient } = params;

  // the EHR only returns the visit when it is the patient's, so another patient's payment is never found
  const ehrData = await getPatientPaymentVisits(billingOystehr, clinicalPatientId, encounterId);
  const visit = ehrData.visits.find((candidate) => candidate.encounterId === encounterId);
  if (!visit) throw FHIR_RESOURCE_NOT_FOUND('Encounter');

  const [billingNoticesByEncounter, claimsByEncounter] = await Promise.all([
    fetchPatientPaymentsByEncounterIds(billingOystehr, [encounterId]),
    fetchClaimsByEncounter(billingOystehr, [encounterId]),
  ]);
  const notices = mergeBillingAndLegacyPaymentNotices(
    billingNoticesByEncounter.get(encounterId) ?? [],
    visit.legacyPaymentNotices
  );
  const notice = notices.find((candidate) => candidate.id === paymentId) ?? adoptedCopyOf(paymentId, visit, notices);
  if (!notice?.id) throw FHIR_RESOURCE_NOT_FOUND('PaymentNotice');

  const dtos = await listEncounterPayments({
    clinical: ehrClinicalPaymentLookups(ehrData),
    billingOystehr,
    stripeClient,
    encounterId,
    fhirPaymentNotices: [notice],
    uncappedCardPayments: true,
    skipEncounterPrefetch: true,
  });
  const [accountPayment] = toAccountPayments({
    visit,
    notices,
    // the resolved id, which differs from paymentId once a legacy payment has been adopted
    dtos: dtos.filter((dto) => dto.fhirPaymentNotificationId === notice.id),
    claims: claimsByEncounter.get(encounterId) ?? [],
  });
  if (!accountPayment) throw FHIR_RESOURCE_NOT_FOUND('PaymentNotice');
  return accountPayment.payment;
};

// A refund or void of a legacy EHR payment adopts it into billing: a billing notice with a new id
// replaces it in the merged list. A link made before that still names the legacy id, so it resolves
// to the billing notice that now stands for it (the caller reads the new id off the response).
const adoptedCopyOf = (
  paymentId: string,
  visit: PatientPaymentVisit,
  notices: PaymentNotice[]
): PaymentNotice | undefined => {
  const legacyNotice = visit.legacyPaymentNotices.find((candidate) => candidate.id === paymentId);
  if (!legacyNotice) return undefined;
  return notices.find((candidate) => candidate.id !== paymentId && shadowsLegacyNotice(candidate, legacyNotice));
};
