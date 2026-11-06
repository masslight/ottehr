import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PreviewBillingNioInvoiceInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { CheckBillingNioInvoiceResponse } from 'utils/lib/types/data/billing/billing.types';
import { APIError, APIErrorCode } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { assembleNioInvoice } from '../nio-invoice';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'check-billing-nio-invoice';

const INVOICE_RULE_ERROR_CODES = new Set<APIErrorCode | undefined>([
  APIErrorCode.INVALID_INPUT,
  APIErrorCode.BILLING_INVOICE_CONFLICT,
  APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
  APIErrorCode.RESOURCE_INCOMPLETE_FOR_OPERATION,
]);

const isInvoiceRuleError = (error: unknown): error is APIError =>
  typeof error === 'object' && error !== null && INVOICE_RULE_ERROR_CODES.has((error as APIError).code);

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const { claimIds, secrets } = validateWithSchema(PreviewBillingNioInvoiceInputSchema, input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect({
    oystehr,
    claimIds,
  });
  console.groupEnd();
  console.debug('performEffect success');

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function performEffect({
  oystehr,
  claimIds,
}: {
  oystehr: Oystehr;
  claimIds: string[];
}): Promise<CheckBillingNioInvoiceResponse> {
  try {
    await assembleNioInvoice({
      oystehr,
      claimIds,
    });
    return {
      invoiceable: true,
    };
  } catch (error) {
    if (!isInvoiceRuleError(error)) throw error;
    return {
      invoiceable: false,
      reason: error.message,
    };
  }
}
