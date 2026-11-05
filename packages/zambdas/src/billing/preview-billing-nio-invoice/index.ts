import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PreviewBillingNioInvoiceInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { PreviewBillingNioInvoiceResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { renderNioInvoicePdf } from '../../shared/pdf/nio-invoice-pdf';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { assembleNioInvoice } from '../nio-invoice';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'preview-billing-nio-invoice';
export const PREVIEW_INVOICE_NUMBER = 'Assigned on create';

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
}): Promise<PreviewBillingNioInvoiceResponse> {
  const { pdf } = await assembleNioInvoice({
    oystehr,
    claimIds,
  });
  const bytes = await renderNioInvoicePdf({
    ...pdf,
    invoiceNumber: PREVIEW_INVOICE_NUMBER,
  });
  return {
    pdfBase64: Buffer.from(bytes).toString('base64'),
  };
}
