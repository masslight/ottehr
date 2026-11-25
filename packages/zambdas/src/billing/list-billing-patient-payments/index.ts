import { APIGatewayProxyResult } from 'aws-lambda';
import { ListPatientPaymentResponse } from 'utils/lib/types/api/patient-payment-types';
import { ListBillingPatientPaymentsInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { fetchPatientPaymentsByEncounterIds } from '../claim-amounts';
import { practitionerNamesFromEhr } from '../clinical-practitioners';
import { ehrClinicalPaymentLookups, getPatientPaymentVisits } from '../ehr-payment-data';
import { listEncounterPayments } from '../patient-payment-dtos';
import { mergeBillingAndLegacyPaymentNotices } from '../patient-payments';
import { createBillingClient } from '../shared';

const ZAMBDA_NAME = 'list-billing-patient-payments';
const STRIPE_REQUEST_TIMEOUT_MS = 10_000;

let m2mToken: string;

// Lists an encounter's patient payments for the EHR: billing notices plus legacy EHR notices,
// enriched with Stripe card and refund details. The clinical side (the visit's schedule Stripe
// account, the patient's Stripe customers and the legacy notices) comes from the EHR's zambda.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(ListBillingPatientPaymentsInputSchema, input);
  const { patientId, encounterId, secrets } = params;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const billingOystehr = createBillingClient(m2mToken, secrets);

  // the EHR only returns the visit when it is the patient's, so another patient's encounter is never listed
  const [ehrData, billingNoticesByEncounter] = await Promise.all([
    getPatientPaymentVisits(billingOystehr, patientId, encounterId),
    fetchPatientPaymentsByEncounterIds(billingOystehr, [encounterId]),
  ]);
  const visit = ehrData.visits.find((candidate) => candidate.encounterId === encounterId);
  if (!visit) {
    throw FHIR_RESOURCE_NOT_FOUND('Encounter');
  }

  const payments = await listEncounterPayments({
    clinical: {
      ...ehrClinicalPaymentLookups(ehrData),
      // billing notices stored without a submitter display are named by the EHR's zambda
      practitionerNames: practitionerNamesFromEhr(billingOystehr),
    },
    billingOystehr,
    stripeClient: getStripeClient(secrets, { timeoutMs: STRIPE_REQUEST_TIMEOUT_MS }),
    encounterId,
    fhirPaymentNotices: mergeBillingAndLegacyPaymentNotices(
      billingNoticesByEncounter.get(encounterId) ?? [],
      visit.legacyPaymentNotices
    ),
  });

  const response: ListPatientPaymentResponse = { patientId, encounterId, payments };
  return { statusCode: 200, body: JSON.stringify(response) };
});
