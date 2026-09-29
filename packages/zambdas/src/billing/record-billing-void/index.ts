import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { parsePaymentVoidFromNotice } from 'utils/lib/fhir/paymentRefunds';
import { RecordBillingVoidResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { voidPaymentNotice } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM } from '../payments';
import { createBillingClient } from '../shared';
import { RecordBillingVoidParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'record-billing-void';

let m2mToken: string;

// Billing-side companion to the EHR patient-payments void zambda: cancels billing copies of the
// voided clinical PaymentNotice. The void state is derived from the authoritative clinical notice
// rather than taken from the caller: EHR roles hold wildcard Zambda:InvokeFunction, so a direct
// caller must only be able to propagate a void that already happened clinically.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, params.secrets);
  const billingOystehr = createBillingClient(m2mToken, params.secrets);
  const response = await performEffect(clinicalOystehr, billingOystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  clinicalOystehr: Oystehr,
  oystehr: Oystehr,
  params: RecordBillingVoidParams
): Promise<RecordBillingVoidResponse> {
  const { clinicalPaymentNoticeId } = params;

  const clinicalNotice = await clinicalOystehr.fhir.get<PaymentNotice>({
    resourceType: 'PaymentNotice',
    id: clinicalPaymentNoticeId,
  });
  const voidInfo = parsePaymentVoidFromNotice(clinicalNotice);
  if (clinicalNotice.status !== 'cancelled' || !voidInfo) {
    throw INVALID_INPUT_ERROR('The clinical payment notice is not voided; there is nothing to record.');
  }

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
