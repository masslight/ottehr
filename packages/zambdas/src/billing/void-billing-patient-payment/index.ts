import { APIGatewayProxyResult } from 'aws-lambda';
import { DateTime } from 'luxon';
import {
  parsePaymentRefundsFromNotice,
  parsePaymentVoidFromNotice,
  settledRefundTotalInCents,
} from 'utils/lib/fhir/paymentRefunds';
import { VoidPatientPaymentResponse } from 'utils/lib/types/api/patient-payment-types';
import { VoidBillingPatientPaymentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { practitionerRefForUser } from '../../shared/practitioners';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient, voidPaymentNotice } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import {
  PAYMENT_MANAGEMENT_ROLES,
  paymentMethodForNotice,
  resolvePaymentNoticeForWrite,
  stripePaymentIntentIdForNotice,
} from '../patient-payments';
import { createBillingClient } from '../shared';

const ZAMBDA_NAME = 'void-billing-patient-payment';

const VOIDABLE_PAYMENT_METHODS = ['cash', 'check', 'external-card-reader'];

let m2mToken: string;

// Voids a payment recorded without a processor link (cash, check, external reader): the billing
// notice is cancelled, so it stops counting toward patient AR.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { encounterId, paymentNoticeId, reason, notes, secrets } = validateWithSchema(
    VoidBillingPatientPaymentInputSchema,
    input
  );

  const user = await requireUserWithRole(getUserToken(input), secrets, PAYMENT_MANAGEMENT_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, secrets);
  const billingOystehr = createBillingClient(m2mToken, secrets);

  const notice = await resolvePaymentNoticeForWrite({
    clinicalOystehr,
    billingOystehr,
    getStripe: () => getStripeClient(secrets),
    paymentNoticeId,
    encounterId,
    secrets,
  });

  const paymentMethod = paymentMethodForNotice(notice);
  if (stripePaymentIntentIdForNotice(notice) || !paymentMethod || !VOIDABLE_PAYMENT_METHODS.includes(paymentMethod)) {
    throw INVALID_INPUT_ERROR('Only cash, check, and external card reader payments can be voided.');
  }
  if (notice.status === 'cancelled' || parsePaymentVoidFromNotice(notice)) {
    throw INVALID_INPUT_ERROR('This payment has already been voided.');
  }
  if (settledRefundTotalInCents(parsePaymentRefundsFromNotice(notice)) > 0) {
    throw INVALID_INPUT_ERROR('This payment has refunds recorded and can no longer be voided.');
  }

  const voidedBy = (await practitionerRefForUser(user, clinicalOystehr)).display;
  await voidPaymentNotice(billingOystehr, notice, {
    reason,
    notes,
    voidedAtISO: DateTime.now().toUTC().toISO() ?? new Date().toISOString(),
    voidedBy,
  });

  const response: VoidPatientPaymentResponse = { paymentNoticeId, voidedBillingNoticeCount: 1 };
  return { statusCode: 200, body: JSON.stringify(response) };
});
