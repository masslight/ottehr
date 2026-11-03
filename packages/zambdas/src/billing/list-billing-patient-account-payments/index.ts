import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Patient, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { PatientPaymentDTO } from 'utils/lib/types/api/patient-payment-types';
import { ListBillingPatientAccountPaymentsInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  BillingPatientAccountPayment,
  BillingPatientPaymentMethod,
  ListBillingPatientAccountPaymentsResponse,
} from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { fetchPatientPaymentsByEncounterIds, fetchResourcesGrouped } from '../claim-amounts';
import { getClaimServiceDate } from '../claim-search';
import { ehrClinicalPaymentLookups, getPatientPaymentVisits } from '../ehr-payment-data';
import { listEncounterPayments } from '../patient-payment-dtos';
import { invoiceIdForPaymentNotice, mergeBillingAndLegacyPaymentNotices } from '../patient-payments';
import { createBillingClient, fetchById, resolveClinicalPatientIds } from '../shared';

const ZAMBDA_NAME = 'list-billing-patient-account-payments';
const STRIPE_REQUEST_TIMEOUT_MS = 10_000;
// encounters whose payments are resolved against Stripe at once
const ENCOUNTER_CONCURRENCY = 5;
const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

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
  const response: ListBillingPatientAccountPaymentsResponse = {
    payments: clinicalId
      ? await listAccountPayments({
          billingOystehr,
          clinicalPatientId: clinicalId,
          stripeClient: getStripeClient(secrets, { timeoutMs: STRIPE_REQUEST_TIMEOUT_MS }),
        })
      : [],
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});

export const listAccountPayments = async (params: {
  billingOystehr: Oystehr;
  clinicalPatientId: string;
  stripeClient: Stripe;
}): Promise<BillingPatientAccountPayment[]> => {
  const { billingOystehr, clinicalPatientId, stripeClient } = params;

  const ehrData = await getPatientPaymentVisits(billingOystehr, clinicalPatientId);
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
  const claimsByEncounter = await fetchResourcesGrouped<Claim>({
    oystehr: billingOystehr,
    resourceType: 'Claim',
    ids: paidVisits.map(({ visit }) => visit.encounterId),
    buildParam: (batch) => [
      { name: 'identifier', value: batch.map((id) => `${CLAIM_ENCOUNTER_ID_SYSTEM}|${id}`).join(',') },
    ],
    groupKeyOf: (claim) =>
      claim.identifier?.find((identifier) => identifier.system === CLAIM_ENCOUNTER_ID_SYSTEM)?.value,
  });

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
        const claim = claimForPayments(claimsByEncounter.get(encounterId) ?? [], notices);
        return dtos.map((dto) => {
          const notice = notices.find((candidate) => candidate.id === dto.fhirPaymentNotificationId);
          const reconciliation = notice?.contained?.find(
            (resource) => resource.resourceType === 'PaymentReconciliation'
          );
          return {
            recordedISO: dto.dateISO,
            payment: {
              ...dto,
              dateISO:
                notice?.paymentDate ??
                (reconciliation?.resourceType === 'PaymentReconciliation' ? reconciliation.paymentDate : undefined) ??
                dto.dateISO,
              method: methodOf(dto, notices),
              encounterId,
              appointmentId: visit.appointmentId,
              visitDateISO: visit.visitDateISO,
              claimId: claim?.id,
              claimServiceDate: claim ? getClaimServiceDate(claim) : undefined,
            },
          };
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

const paymentDayOf = (iso: string): string => DateTime.fromISO(iso, { zone: 'utc' }).toISODate() ?? iso;

// the claim the billing notices were reconciled to, else the encounter's only claim
const claimForPayments = (claims: Claim[], notices: PaymentNotice[]): Claim | undefined => {
  const linkedClaimIds = new Set(
    notices
      .map((notice) => notice.request?.reference)
      .filter((reference): reference is string => Boolean(reference?.startsWith('Claim/')))
      .map((reference) => reference.slice('Claim/'.length))
  );
  return claims.find((claim) => claim.id && linkedClaimIds.has(claim.id)) ?? claims[0];
};

const methodOf = (payment: PatientPaymentDTO, notices: PaymentNotice[]): BillingPatientPaymentMethod => {
  const notice = notices.find((candidate) => candidate.id === payment.fhirPaymentNotificationId);
  return notice && invoiceIdForPaymentNotice(notice) ? 'invoice' : payment.paymentMethod;
};
