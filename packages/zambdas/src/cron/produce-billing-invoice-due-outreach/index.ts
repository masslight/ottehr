import { APIGatewayProxyResult } from 'aws-lambda';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { produceBillingInvoiceDueOutreach } from '../../billing/invoice-outreach';
import { createBillingClient } from '../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { isOutreachInBillingApp } from '../../shared/invoice-tasks';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';

let m2mToken: string;
const ZAMBDA_NAME = 'produce-billing-invoice-due-outreach';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  if (!isOutreachInBillingApp(input.secrets)) {
    console.log(`${ZAMBDA_NAME}: outreach is not enabled in the billing app, skipping`);
    return { statusCode: 200, body: JSON.stringify({ disabled: true }) };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const result = await produceBillingInvoiceDueOutreach(oystehr);
  // Thrown after the run so the other invoices are still processed and wrapHandler reports the failures.
  if (result.errors) throw new Error(`${ZAMBDA_NAME}: ${result.errors} invoice(s) failed`);
  return { statusCode: 200, body: JSON.stringify(result) };
});
