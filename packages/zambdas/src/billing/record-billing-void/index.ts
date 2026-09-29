import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { RecordBillingVoidResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { voidPaymentNotice } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM } from '../payments';
import { createBillingClient } from '../shared';
import { RecordBillingVoidParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'record-billing-void';

let m2mToken: string;

// Billing-side companion to the EHR patient-payments void zambda: cancels billing copies of the
// voided clinical PaymentNotice. Lives here because EHR zambdas must not write billing-tagged
// resources directly.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const billingOystehr = createBillingClient(m2mToken, params.secrets);
  const response = await performEffect(billingOystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: RecordBillingVoidParams): Promise<RecordBillingVoidResponse> {
  const { clinicalPaymentNoticeId, voidInfo } = params;

  // billing copies carry the clinical notice id as their dedup identifier
  const billingNotices = (
    await oystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [{ name: 'identifier', value: `${CLINICAL_PAYMENT_NOTICE_ID_SYSTEM}|${clinicalPaymentNoticeId}` }],
    })
  ).unbundle();

  for (const billingNotice of billingNotices) {
    await voidPaymentNotice(oystehr, billingNotice, voidInfo);
  }

  return { billingNoticesVoided: billingNotices.length };
}
