import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { parsePaymentRefundsFromNotice } from 'utils/lib/fhir/paymentRefunds';
import { RecordBillingRefundResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { shouldUseOttehrBilling } from '../../shared/candid';
import { wrapHandler } from '../../shared/sentry';
import { applyRefundsToPaymentNotice, STRIPE_PAYMENT_ID_SYSTEM } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, recordBillingManualRefund } from '../payments';
import { createBillingClient } from '../shared';
import { RecordBillingRefundParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'record-billing-refund';

let m2mToken: string;

// Billing-side companion to the EHR patient-payments refund zambda: stamps the refunds extension
// on billing copies of the clinical PaymentNotice and records the negative AR offset notice.
// Lives here because EHR zambdas must not write billing-tagged resources directly.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const billingOystehr = createBillingClient(m2mToken, params.secrets);
  const response = await performEffect(billingOystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: RecordBillingRefundParams
): Promise<RecordBillingRefundResponse> {
  const { encounterId, clinicalPaymentNoticeId, stripePaymentId, refunds, removeIds, arOffset, secrets } = params;

  // billing copies carry the clinical notice id; stripe-bridged copies carry the payment-intent id
  const identifierValues = [
    `${CLINICAL_PAYMENT_NOTICE_ID_SYSTEM}|${clinicalPaymentNoticeId}`,
    ...(stripePaymentId ? [`${STRIPE_PAYMENT_ID_SYSTEM}|${stripePaymentId}`] : []),
  ].join(',');
  const billingNotices = (
    await oystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [{ name: 'identifier', value: identifierValues }],
    })
  ).unbundle();

  for (const billingNotice of billingNotices) {
    // union with the copy's own stamped refunds: the webhook may have stamped a newer Stripe
    // refund here that the caller's clinical snapshot predates
    const copyRefunds = parsePaymentRefundsFromNotice(billingNotice) ?? [];
    const knownIds = new Set(refunds.map((refund) => refund.stripeRefundId));
    const copyOnly = copyRefunds.filter((refund) => !knownIds.has(refund.stripeRefundId));
    await applyRefundsToPaymentNotice(oystehr, billingNotice, [...refunds, ...copyOnly], removeIds);
  }

  // Gate on the billing flag, not on billing copies existing: the positive copy is bridged
  // asynchronously, and a FHIR-only refund has no later Stripe event to repair a missed offset.
  // recordBillingManualRefund tolerates the claim/copy arriving later.
  if (arOffset && shouldUseOttehrBilling(secrets)) {
    await recordBillingManualRefund(oystehr, { encounterId, ...arOffset, secrets });
  }

  return { billingNoticesStamped: billingNotices.length };
}
