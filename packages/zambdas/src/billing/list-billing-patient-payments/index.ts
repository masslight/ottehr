import { APIGatewayProxyResult } from 'aws-lambda';
import { ListPatientPaymentResponse } from 'utils/lib/types/api/patient-payment-types';
import { ListBillingPatientPaymentsInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { getAccountAndCoverageResourcesForPatient } from '../../ehr/shared/harvest';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { getPaymentsForEncounter } from '../patient-payment-dtos';
import { createBillingClient } from '../shared';

const ZAMBDA_NAME = 'list-billing-patient-payments';
const STRIPE_REQUEST_TIMEOUT_MS = 10_000;

let m2mToken: string;

// Lists an encounter's patient payments for the EHR: billing notices plus legacy EHR notices,
// enriched with Stripe card and refund details.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(ListBillingPatientPaymentsInputSchema, input);
  const { patientId, encounterId, secrets } = params;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  // eslint-disable-next-line ottehr/billing-fhir-client-only -- reads the patient's Account and legacy clinical payment notices
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, secrets);
  const billingOystehr = createBillingClient(m2mToken, secrets);

  const { account } = await getAccountAndCoverageResourcesForPatient(patientId, clinicalOystehr);
  if (!account?.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Account');
  }

  const payments = await getPaymentsForEncounter({
    clinicalOystehr,
    billingOystehr,
    stripeClient: getStripeClient(secrets, { timeoutMs: STRIPE_REQUEST_TIMEOUT_MS }),
    account,
    encounterId,
  });

  const response: ListPatientPaymentResponse = { patientId, encounterId, payments };
  return { statusCode: 200, body: JSON.stringify(response) };
});
