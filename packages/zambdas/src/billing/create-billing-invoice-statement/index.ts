import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BillingInvoiceStatementInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { getInvoiceEncounterId } from '../invoices';
import { createBillingClient } from '../shared';

const ZAMBDA_NAME = 'create-billing-invoice-statement';
const CREATE_GENERATE_STATEMENT_TASK_ZAMBDA_KEY = 'create-generate-statement-task';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { invoiceId, secrets } = validateWithSchema(BillingInvoiceStatementInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  await performEffect(createBillingClient(m2mToken, secrets), invoiceId);
  return { statusCode: 200, body: JSON.stringify({}) };
});

// The EHR makes the PDF and files it in the patient's chart, where the patient portal shows it too.
export async function performEffect(oystehr: Oystehr, invoiceId: string): Promise<void> {
  const encounterId = await getInvoiceEncounterId(oystehr, invoiceId);
  await oystehr.zambda.execute({ id: CREATE_GENERATE_STATEMENT_TASK_ZAMBDA_KEY, encounterId, billingAppInvoice: true });
}
