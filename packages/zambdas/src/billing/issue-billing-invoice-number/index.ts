import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { formatInvoiceNumber } from 'utils/lib/fhir/billing-invoice';
import { IssueBillingInvoiceNumberResponse } from 'utils/lib/types/data/billing/billing.types';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { nextCounterValue } from '../../shared/fhir-counter';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'issue-billing-invoice-number';

// One counter for patient and NIO invoices.
export const INVOICE_NUMBER_COUNTER_KEY = 'invoice-number';

// the returned number counts as used even if the caller never creates the invoice
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  console.group('performEffect');
  const response = await performEffect(oystehr);
  console.groupEnd();
  console.debug('performEffect success');

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function performEffect(oystehr: Oystehr): Promise<IssueBillingInvoiceNumberResponse> {
  return {
    invoiceNumber: formatInvoiceNumber(await nextCounterValue(oystehr, INVOICE_NUMBER_COUNTER_KEY)),
  };
}
