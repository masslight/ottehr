import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { paymentDayOf } from 'utils/lib/helpers/rcm/payment-day';
import { GetPatientPaymentVisitsResponse, PatientPaymentVisit } from 'utils/lib/types/api/patient-payment-visits.types';
import { ListBillingPatientAccountPaymentsInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  BillingPatientAccountPayment,
  BillingPatientVisit,
  ListBillingPatientAccountPaymentsResponse,
} from 'utils/lib/types/data/billing/billing.types';
import { compareDates } from 'utils/lib/utils/dateUtils';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { fetchPatientPaymentsByEncounterIds } from '../claim-amounts';
import { ehrClinicalPaymentLookups, getPatientPaymentVisits } from '../ehr-payment-data';
import { fetchClaimsByEncounter, toAccountPayments } from '../patient-account-payments';
import { listEncounterPayments } from '../patient-payment-dtos';
import { mergeBillingAndLegacyPaymentNotices } from '../patient-payments';
import { createBillingClient, fetchById, resolveClinicalPatientIds } from '../shared';

const ZAMBDA_NAME = 'list-billing-patient-account-payments';
const STRIPE_REQUEST_TIMEOUT_MS = 10_000;
// encounters whose payments are resolved against Stripe at once
const ENCOUNTER_CONCURRENCY = 5;

let m2mToken: string;

// Lists every payment on a billing patient's account, across all of the clinical patient's visits,
// with the visit and claim each one belongs to. The visits and the clinical side of each payment
// come from the EHR's get-patient-payment-visits.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, secrets } = validateWithSchema(ListBillingPatientAccountPaymentsInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const billingOystehr = createBillingClient(m2mToken, secrets);

  const patient = await fetchById<Patient>(billingOystehr, 'Patient', patientId);
  const { clinicalId } = await resolveClinicalPatientIds({ oystehr: billingOystehr, patient });

  // payments are taken against clinical visits, so a patient created in billing alone has none
  if (!clinicalId) {
    const empty: ListBillingPatientAccountPaymentsResponse = { payments: [], visits: [] };
    return { statusCode: 200, body: JSON.stringify(empty) };
  }

  const ehrData = await getPatientPaymentVisits(billingOystehr, clinicalId);
  const response: ListBillingPatientAccountPaymentsResponse = {
    payments: await listAccountPayments({
      billingOystehr,
      ehrData,
      stripeClient: getStripeClient(secrets, { timeoutMs: STRIPE_REQUEST_TIMEOUT_MS }),
    }),
    visits: accountVisits(ehrData.visits),
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});

// the visits a payment can be recorded against, newest first; undated visits last
export const accountVisits = (visits: PatientPaymentVisit[]): BillingPatientVisit[] =>
  visits
    .map(({ encounterId, appointmentId, visitDateISO, serviceMode, followUp, locationName, visitReason }) => ({
      encounterId,
      appointmentId,
      visitDateISO,
      serviceMode,
      followUp,
      locationName,
      visitReason,
    }))
    .sort((a, b) => compareDates(a.visitDateISO, b.visitDateISO));

export const listAccountPayments = async (params: {
  billingOystehr: Oystehr;
  ehrData: GetPatientPaymentVisitsResponse;
  stripeClient: Stripe;
}): Promise<BillingPatientAccountPayment[]> => {
  const { billingOystehr, ehrData, stripeClient } = params;

  const { visits } = ehrData;
  if (visits.length === 0) return [];

  const billingNoticesByEncounter = await fetchPatientPaymentsByEncounterIds(
    billingOystehr,
    visits.map((visit) => visit.encounterId)
  );
  const paidVisits = visits
    .map((visit) => ({
      visit,
      notices: mergeBillingAndLegacyPaymentNotices(
        billingNoticesByEncounter.get(visit.encounterId) ?? [],
        visit.legacyPaymentNotices
      ),
    }))
    .filter(({ notices }) => notices.length > 0);
  if (paidVisits.length === 0) return [];

  const clinical = ehrClinicalPaymentLookups(ehrData);
  const claimsByEncounter = await fetchClaimsByEncounter(
    billingOystehr,
    paidVisits.map(({ visit }) => visit.encounterId)
  );

  const payments: { payment: BillingPatientAccountPayment; recordedISO: string }[] = [];
  for (let i = 0; i < paidVisits.length; i += ENCOUNTER_CONCURRENCY) {
    const batch = await Promise.all(
      paidVisits.slice(i, i + ENCOUNTER_CONCURRENCY).map(async ({ visit, notices }) => {
        const { encounterId } = visit;
        const dtos = await listEncounterPayments({
          clinical,
          billingOystehr,
          stripeClient,
          encounterId,
          fhirPaymentNotices: notices,
          // an account listing must not drop payments the way the EHR visit list caps them
          uncappedCardPayments: true,
        });
        return toAccountPayments({
          visit,
          notices,
          dtos,
          claims: claimsByEncounter.get(encounterId) ?? [],
        });
      })
    );
    payments.push(...batch.flat());
  }

  // Newest payment day first. A manual payment's date is a date-only paymentDate (it may be backdated),
  // so within a day the time each payment was recorded orders it against timestamped Stripe payments.
  return payments
    .sort(
      (a, b) =>
        paymentDayOf(b.payment.dateISO).localeCompare(paymentDayOf(a.payment.dateISO)) ||
        DateTime.fromISO(b.recordedISO).toMillis() - DateTime.fromISO(a.recordedISO).toMillis()
    )
    .map(({ payment }) => payment);
};
