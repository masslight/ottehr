import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Invoice } from 'fhir/r4b';
import { PresignBillingInvoicePaymentAttachmentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { PresignBillingInvoicePaymentAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { INVOICE_ATTACHMENT_PATH_PREFIX, newAttachmentLocation, presignAttachment } from '../attachments';
import { assertInvoiceTakesRecordedPayments } from '../invoices';
import { createBillingClient, fetchById } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'presign-billing-invoice-payment-attachment';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateWithSchema(PresignBillingInvoicePaymentAttachmentInputSchema, input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  console.group('performEffect');
  const response = await performEffect({
    oystehr,
    params,
  });
  console.groupEnd();
  console.debug('performEffect success');

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

// Uploading before recording means a failed upload leaves at worst an orphan file, never a record.
export async function performEffect({
  oystehr,
  params,
}: {
  oystehr: Oystehr;
  params: ValidatedZambdaInput<typeof PresignBillingInvoicePaymentAttachmentInputSchema>;
}): Promise<PresignBillingInvoicePaymentAttachmentResponse> {
  const { invoiceId, fileName, secrets } = params;
  assertInvoiceTakesRecordedPayments(await fetchById<Invoice>(oystehr, 'Invoice', invoiceId));
  const location = newAttachmentLocation(secrets['PROJECT_ID'], INVOICE_ATTACHMENT_PATH_PREFIX, invoiceId, fileName);
  return {
    uploadUrl: await presignAttachment(oystehr, location, 'upload'),
    path: location.path,
  };
}
