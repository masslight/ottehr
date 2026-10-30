import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim } from 'fhir/r4b';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { GET_BILLING_INVOICE_VISIT_ZAMBDA_KEY } from 'utils/lib/types/api/invoicing.types';
import { GetBillingInvoiceRecipientInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { GetBillingInvoiceRecipientResponse } from 'utils/lib/types/data/billing/billing.types';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { getInvoiceableEncounterId } from '../invoices';
import { createBillingClient, fetchById } from '../shared';

const ZAMBDA_NAME = 'get-billing-invoice-recipient';

let m2mToken: string;

// Read only. The Send Invoice dialog shows who the invoice and SMS will go to. Billing resolves the claim's
// visit, and the clinical get-billing-invoice-visit reads the patient, responsible party and portal users.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { claimId, secrets } = validateWithSchema(GetBillingInvoiceRecipientInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  const response = await performEffect(oystehr, claimId);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(oystehr: Oystehr, claimId: string): Promise<GetBillingInvoiceRecipientResponse> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', claimId);
  const encounterId = getInvoiceableEncounterId(claim);
  return chooseJson<GetBillingInvoiceRecipientResponse>(
    await oystehr.zambda.execute({ id: GET_BILLING_INVOICE_VISIT_ZAMBDA_KEY, encounterId })
  );
}
