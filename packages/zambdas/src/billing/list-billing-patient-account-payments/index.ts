import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Claim, Encounter, Patient, PaymentNotice } from 'fhir/r4b';
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
import { getAccountAndCoverageResourcesForPatient } from '../../ehr/shared/harvest';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { fetchAllPages } from '../../shared/fhir';
// eslint-disable-next-line no-restricted-imports -- reads the patient's Encounters, Appointments, Account and legacy clinical payment notices
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { fetchResourcesGrouped } from '../claim-amounts';
import { getClaimServiceDate } from '../claim-search';
import { getPaymentsForEncounter } from '../patient-payment-dtos';
import { fetchEncounterPaymentNotices, invoiceIdForPaymentNotice } from '../patient-payments';
import { createBillingClient, fetchById, resolveClinicalPatientIds } from '../shared';

const ZAMBDA_NAME = 'list-billing-patient-account-payments';
const STRIPE_REQUEST_TIMEOUT_MS = 10_000;
// encounters whose payments are resolved against Stripe at once
const ENCOUNTER_CONCURRENCY = 5;
const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

let m2mToken: string;

// Lists every payment on a billing patient's account, across all of the clinical patient's visits,
// with the visit and claim each one belongs to.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, secrets } = validateWithSchema(ListBillingPatientAccountPaymentsInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, secrets);
  const billingOystehr = createBillingClient(m2mToken, secrets);

  const patient = await fetchById<Patient>(billingOystehr, 'Patient', patientId);
  const { clinicalId } = await resolveClinicalPatientIds({ oystehr: billingOystehr, patient });

  // payments are taken against clinical visits, so a patient created in billing alone has none
  const response: ListBillingPatientAccountPaymentsResponse = {
    payments: clinicalId
      ? await listAccountPayments({
          clinicalOystehr,
          billingOystehr,
          clinicalPatientId: clinicalId,
          stripeClient: getStripeClient(secrets, { timeoutMs: STRIPE_REQUEST_TIMEOUT_MS }),
        })
      : [],
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});

export const listAccountPayments = async (params: {
  clinicalOystehr: Oystehr;
  billingOystehr: Oystehr;
  clinicalPatientId: string;
  stripeClient: Stripe;
}): Promise<BillingPatientAccountPayment[]> => {
  const { clinicalOystehr, billingOystehr, clinicalPatientId, stripeClient } = params;

  const { encounters, appointmentsById } = await fetchPatientEncounters(clinicalOystehr, clinicalPatientId);
  const encounterIds = encounters.map((encounter) => encounter.id).filter((id): id is string => Boolean(id));
  if (encounterIds.length === 0) return [];

  const noticesByEncounter = await fetchEncounterPaymentNotices({ clinicalOystehr, billingOystehr, encounterIds });
  const paidEncounters = encounters.filter((encounter) => noticesByEncounter.get(encounter.id ?? '')?.length);
  if (paidEncounters.length === 0) return [];

  const [{ account }, claimsByEncounter] = await Promise.all([
    getAccountAndCoverageResourcesForPatient(clinicalPatientId, clinicalOystehr),
    fetchResourcesGrouped<Claim>({
      oystehr: billingOystehr,
      resourceType: 'Claim',
      ids: paidEncounters.map((encounter) => encounter.id ?? ''),
      buildParam: (batch) => [
        { name: 'identifier', value: batch.map((id) => `${CLAIM_ENCOUNTER_ID_SYSTEM}|${id}`).join(',') },
      ],
      groupKeyOf: (claim) =>
        claim.identifier?.find((identifier) => identifier.system === CLAIM_ENCOUNTER_ID_SYSTEM)?.value,
    }),
  ]);

  const payments: BillingPatientAccountPayment[] = [];
  for (let i = 0; i < paidEncounters.length; i += ENCOUNTER_CONCURRENCY) {
    const batch = await Promise.all(
      paidEncounters.slice(i, i + ENCOUNTER_CONCURRENCY).map(async (encounter) => {
        const encounterId = encounter.id ?? '';
        const notices = noticesByEncounter.get(encounterId) ?? [];
        const dtos = await getPaymentsForEncounter({
          clinicalOystehr,
          billingOystehr,
          stripeClient,
          account,
          encounterId,
          fhirPaymentNotices: notices,
        });
        const appointment = appointmentsById.get(appointmentIdOf(encounter) ?? '');
        const claim = claimForPayments(claimsByEncounter.get(encounterId) ?? [], notices);
        return dtos.map(
          (dto): BillingPatientAccountPayment => ({
            ...dto,
            method: methodOf(dto, notices),
            encounterId,
            appointmentId: appointment?.id,
            visitDateISO: appointment?.start ?? encounter.period?.start,
            claimId: claim?.id,
            claimServiceDate: claim ? getClaimServiceDate(claim) : undefined,
          })
        );
      })
    );
    payments.push(...batch.flat());
  }

  return payments.sort((a, b) => DateTime.fromISO(b.dateISO).toMillis() - DateTime.fromISO(a.dateISO).toMillis());
};

const fetchPatientEncounters = async (
  clinicalOystehr: Oystehr,
  clinicalPatientId: string
): Promise<{ encounters: Encounter[]; appointmentsById: Map<string, Appointment> }> => {
  const encounters: Encounter[] = [];
  const appointmentsById = new Map<string, Appointment>();
  await fetchAllPages(async (offset, count) => {
    const bundle = await clinicalOystehr.fhir.search<Encounter | Appointment>({
      resourceType: 'Encounter',
      params: [
        { name: 'subject', value: `Patient/${clinicalPatientId}` },
        { name: '_include', value: 'Encounter:appointment' },
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    for (const resource of bundle.unbundle()) {
      if (resource.resourceType === 'Encounter') encounters.push(resource);
      else if (resource.id) appointmentsById.set(resource.id, resource);
    }
    return bundle;
  }, 100);
  return { encounters, appointmentsById };
};

const appointmentIdOf = (encounter: Encounter): string | undefined =>
  encounter.appointment?.[0]?.reference?.replace('Appointment/', '');

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
