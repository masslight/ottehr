import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import {
  isLocallyRecordedRefund,
  isPendingReservation,
  parsePaymentRefundsFromNotice,
  staleReservationIds,
} from 'utils/lib/fhir/paymentRefunds';
import { getOrCreateCandidApiClient } from 'utils/lib/helpers/candidApi';
import { RecordBillingRefundResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { shouldUseCandid, shouldUseOttehrBilling, syncCandidPatientRefunds } from '../../shared/candid';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { applyRefundsToPaymentNotice, STRIPE_PAYMENT_ID_SYSTEM } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, recordBillingManualRefund } from '../payments';
import { createBillingClient } from '../shared';
import { RecordBillingRefundParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'record-billing-refund';

let m2mToken: string;

// Billing-side companion to the EHR patient-payments refund zambda: stamps billing copies of the
// clinical PaymentNotice and records negative AR offsets for FHIR-only (manual/external) refunds.
// Everything is derived from the authoritative clinical notice rather than taken from the caller:
// EHR roles hold wildcard Zambda:InvokeFunction, so a direct caller must only be able to trigger
// an idempotent re-sync of clinical truth, never fabricate refunds or offsets.
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
  params: RecordBillingRefundParams
): Promise<RecordBillingRefundResponse> {
  const { clinicalPaymentNoticeId, secrets } = params;

  const clinicalNotice = await clinicalOystehr.fhir.get<PaymentNotice>({
    resourceType: 'PaymentNotice',
    id: clinicalPaymentNoticeId,
  });
  const refunds = parsePaymentRefundsFromNotice(clinicalNotice) ?? [];
  const stripePaymentId = clinicalNotice.identifier?.find((id) => id.system === STRIPE_PAYMENT_ID_SYSTEM)?.value;
  const encounterId = clinicalNotice.request?.reference?.startsWith('Encounter/')
    ? clinicalNotice.request.reference.split('/')[1]
    : undefined;
  const clinicalPaymentMethod = clinicalNotice.extension?.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)
    ?.valueString;

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
    // refund here that the clinical notice doesn't carry yet
    const copyRefunds = parsePaymentRefundsFromNotice(billingNotice) ?? [];
    const knownIds = new Set(refunds.map((refund) => refund.stripeRefundId));
    const copyOnly = copyRefunds.filter((refund) => !knownIds.has(refund.stripeRefundId));
    const merged = [...refunds, ...copyOnly];
    await applyRefundsToPaymentNotice(oystehr, billingNotice, merged, staleReservationIds(merged));
  }

  // Negative AR offsets for FHIR-only refunds (processor refunds arrive via the stripe webhook).
  // Gate on the billing flag, not on billing copies existing: the positive copy is bridged
  // asynchronously, and a FHIR-only refund has no later Stripe event to repair a missed offset.
  // recordBillingManualRefund dedups by refund id, so re-syncing every entry is idempotent.
  const manualRefunds = refunds.filter((refund) => isLocallyRecordedRefund(refund) && !isPendingReservation(refund));
  if (encounterId && shouldUseOttehrBilling(secrets)) {
    for (const entry of manualRefunds) {
      // external refunds carry the return medium; manual refunds use the payment's own method
      const paymentMethod = entry.medium ?? clinicalPaymentMethod;
      if (!paymentMethod) continue;
      await recordBillingManualRefund(oystehr, {
        encounterId,
        refundId: entry.stripeRefundId,
        amountInCents: entry.amountInCents,
        paymentMethod,
        createdISO: entry.dateISO,
        reason: entry.reason ?? 'Other',
        secrets,
      });
    }
  }

  // Candid imports Stripe refunds on its own, but FHIR-only refunds never produce a Stripe
  // event, so they must be pushed explicitly (note-marker dedup keeps re-syncs idempotent).
  let candidRefundsRecorded = 0;
  if (encounterId && shouldUseCandid(secrets) && manualRefunds.length > 0) {
    const candidApiClient = await getOrCreateCandidApiClient(clinicalOystehr, secrets);
    candidRefundsRecorded = await syncCandidPatientRefunds({
      encounterId,
      refunds: manualRefunds,
      oystehr: clinicalOystehr,
      candidApiClient,
    });
  }

  return { billingNoticesStamped: billingNotices.length, candidRefundsRecorded };
}
