import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { IssueBillingInvoiceNumberResponse } from 'utils/lib/types/data/billing/billing.types';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { issueInvoiceNumber } from '../invoice-number';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'issue-billing-invoice-number';

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
    invoiceNumber: await issueInvoiceNumber(oystehr),
  };
}
